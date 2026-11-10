#!/usr/bin/env node
// claude-code-base installer.
//
//   npx -y github:bagasalfanto/claude-code-base init --stack nextjs        (inside the project folder)
//   node <path-to-this-repo>/bin/init.mjs init --stack laravel --target ../my-app
//   node <path-to-this-repo>/bin/init.mjs doctor --target ../my-app
//
// Options for init:
//   --stack nextjs|laravel   auto-detected from package.json / composer.json when omitted
//   --target <dir>           default: current folder
//   --dry-run                print what would happen, change nothing
//   --update                 refresh kit-owned files (hooks, scripts, kit skills, agents, library);
//                            your own edits to other files are kept, a .kit-new copy is written next to them
//   --with-skills            also install Matt Pocock's skills + extras via the skills.sh CLI
//   --no-githooks            don't set git core.hooksPath to .githooks
//
// The installer never deletes anything and never overwrites a file you changed.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT_VERSION = JSON.parse(fs.readFileSync(path.join(KIT_ROOT, "package.json"), "utf8")).version;
const STACKS = fs.readdirSync(path.join(KIT_ROOT, "stacks")).filter((d) => fs.statSync(path.join(KIT_ROOT, "stacks", d)).isDirectory());
const MARK = "claude-code-base";

// Files the kit owns: refreshed by --update. Everything else is yours after the first install.
const KIT_OWNED = [
  /^\.claude\/hooks\//,
  /^\.claude\/scripts\//,
  /^\.claude\/library\//,
  /^\.claude\/skills\/(scope-lock|ui-verify|db-change|retro-apply|kit-setup)\//,
  /^\.claude\/agents\/(ui-tester|button-tester)\.md$/,
  /^\.claude\/state\/\.gitignore$/,
  /^tests\/e2e\/all-buttons\.spec\.ts$/,
  /^tests\/e2e\/README\.md$/,
  /^\.githooks\/pre-commit$/,
  /^CLAUDE\.local\.md\.example$/,
];
// Folder names that can't be stored as dot-folders in every tool, mapped at install time.
const DIR_MAP = { _claude: ".claude", _github: ".github", _githooks: ".githooks" };
// Stack overlay files that land somewhere else or get merged.
const STACK_SPECIAL = {
  "AGENTS.md": { to: "AGENTS.md" },
  "playwright.config.ts": { to: "playwright.config.ts" },
  "database.md": { to: "docs/database.md" },
  "kit.config.json": { merge: "kitConfig" },
  "settings.json": { merge: "settings" },
  "kit-skills.json": { merge: "kitSkills" },
  "CODING_STANDARDS.stack.md": { merge: "standards" },
};

const GITIGNORE_BLOCK = (stack) =>
  [
    `# >>> ${MARK}`,
    ".claude/settings.local.json",
    ".claude/state/*",
    "!.claude/state/.gitignore",
    "CLAUDE.local.md",
    "tests/e2e/.auth/",
    "test-results/",
    "playwright-report/",
    "blob-report/",
    "playwright/.cache/",
    ...(stack === "nextjs" ? ["*.db", "*.db-journal"] : []),
    "# .scratch/ is committed on purpose: specs, tickets and scope cards are project history.",
    `# <<< ${MARK}`,
  ].join("\n");

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith("-") ? argv[0] : "help";
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
};
const target = path.resolve(typeof opt("target") === "string" ? opt("target") : process.cwd());
const dry = !!opt("dry-run");
const update = !!opt("update");

const log = (s = "") => console.log(s);
function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- helpers
const posix = (p) => p.split(path.sep).join("/");
function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(posix(path.relative(base, full)));
  }
  return out;
}
function mapRel(rel) {
  const [first, ...rest] = rel.split("/");
  return [DIR_MAP[first] || first, ...rest].join("/");
}
const readJson = (f, fb) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fb;
  }
};
const uniq = (a) => [...new Set(a)];
const isKitOwned = (rel) => KIT_OWNED.some((re) => re.test(rel));
const same = (a, b) => a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");

function detectStack(dir) {
  const pkg = readJson(path.join(dir, "package.json"), {});
  const composer = readJson(path.join(dir, "composer.json"), {});
  if ({ ...(composer.require || {}) }["laravel/framework"]) return "laravel";
  if ({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }.next) return "nextjs";
  const cfg = readJson(path.join(dir, ".claude", "kit.config.json"), {});
  if (STACKS.includes(cfg.stack)) return cfg.stack;
  return null;
}

// ---------------------------------------------------------------- merges
const LIST_KEYS = ["protected", "alwaysEditable", "nonCode", "migrationGlobs", "uiGlobs", "uiTestSteps"];
function mergeKitConfig(base, over) {
  const out = { ...base, ...over };
  for (const k of LIST_KEYS) if (base[k] || over[k]) out[k] = uniq([...(base[k] || []), ...(over[k] || [])]);
  out.agentPaths = { ...(base.agentPaths || {}), ...(over.agentPaths || {}) };
  out.bashGuard = {
    deny: [...((base.bashGuard || {}).deny || []), ...((over.bashGuard || {}).deny || [])],
    ask: [...((base.bashGuard || {}).ask || []), ...((over.bashGuard || {}).ask || [])],
  };
  return out;
}
// On --update: the user's existing config wins for every value; list keys gain new kit entries.
function refreshKitConfig(fresh, existing) {
  const out = { ...fresh, ...existing };
  for (const k of LIST_KEYS) out[k] = uniq([...(existing[k] || []), ...(fresh[k] || [])]);
  out.agentPaths = { ...(fresh.agentPaths || {}), ...(existing.agentPaths || {}) };
  out.kitVersion = KIT_VERSION;
  return out;
}
function mergeSettings(base, over) {
  const out = JSON.parse(JSON.stringify(base));
  out.permissions = out.permissions || {};
  for (const k of ["allow", "ask", "deny"]) {
    const add = ((over.permissions || {})[k]) || [];
    if (add.length || out.permissions[k]) out.permissions[k] = uniq([...(out.permissions[k] || []), ...add]);
  }
  out.hooks = out.hooks || {};
  for (const [event, groups] of Object.entries(over.hooks || {})) {
    out.hooks[event] = out.hooks[event] || [];
    for (const g of groups) {
      const cmds = (g.hooks || []).map((h) => h.command);
      const exists = out.hooks[event].some((eg) => (eg.hooks || []).some((h) => cmds.includes(h.command)));
      if (!exists) out.hooks[event].push(g);
    }
  }
  for (const [k, v] of Object.entries(over)) if (!["permissions", "hooks"].includes(k) && !(k in out)) out[k] = v;
  return out;
}
function mergeKitSkills(base, over) {
  const out = { ...base, ...over, sources: [] };
  for (const s of [...(base.sources || []), ...(over.sources || [])]) {
    const hit = out.sources.find((x) => x.source === s.source);
    if (hit) {
      hit.skills = uniq([...(hit.skills || []), ...(s.skills || [])]);
      hit.required = hit.required || s.required;
    } else out.sources.push({ ...s, skills: [...(s.skills || [])] });
  }
  return out;
}

// ---------------------------------------------------------------- plan
function buildPlan(stack) {
  const files = new Map(); // destRel -> { content: string|Buffer, mode?, how }
  const T = path.join(KIT_ROOT, "template");
  const S = path.join(KIT_ROOT, "stacks", stack);
  let kitConfig, settings, kitSkills, standards;

  for (const rel of walk(T)) {
    const dest = mapRel(rel);
    const src = path.join(T, rel);
    if (dest === ".claude/kit.config.json") kitConfig = readJson(src);
    else if (dest === ".claude/settings.json") settings = readJson(src);
    else if (dest === ".claude/kit-skills.json") kitSkills = readJson(src);
    else if (dest === "CODING_STANDARDS.md") standards = fs.readFileSync(src, "utf8");
    else files.set(dest, { src, mode: fs.statSync(src).mode });
  }
  for (const rel of walk(S)) {
    const src = path.join(S, rel);
    const special = STACK_SPECIAL[rel];
    if (special && special.merge === "kitConfig") kitConfig = mergeKitConfig(kitConfig, readJson(src));
    else if (special && special.merge === "settings") settings = mergeSettings(settings, readJson(src));
    else if (special && special.merge === "kitSkills") kitSkills = mergeKitSkills(kitSkills, readJson(src));
    else if (special && special.merge === "standards") standards += fs.readFileSync(src, "utf8");
    else files.set(special ? special.to : mapRel(rel), { src, mode: fs.statSync(src).mode });
  }
  // Generated rather than shipped: npm strips .gitignore files from packages (npx github:...).
  files.set(".claude/state/.gitignore", { content: "*\n!.gitignore\n" });
  kitConfig.stack = stack;
  kitConfig.kitVersion = KIT_VERSION;
  files.set(".claude/kit.config.json", { content: JSON.stringify(kitConfig, null, 2) + "\n", json: "kitConfig" });
  files.set(".claude/settings.json", { content: JSON.stringify(settings, null, 2) + "\n", json: "settings" });
  files.set(".claude/kit-skills.json", { content: JSON.stringify(kitSkills, null, 2) + "\n", json: "kitSkills" });
  files.set("CODING_STANDARDS.md", { content: standards });
  return files;
}

// ---------------------------------------------------------------- init
function init() {
  if (!fs.existsSync(target)) {
    if (dry) log(`(would create ${target})`);
    else fs.mkdirSync(target, { recursive: true });
  }
  let stack = opt("stack");
  if (stack === true) die("--stack needs a value: " + STACKS.join(" | "));
  stack = stack || detectStack(target);
  if (!stack) die(`Could not detect the stack. Pass --stack ${STACKS.join("|")}\n  (create the app first, e.g. npx create-next-app@latest . / composer create-project laravel/laravel .)`);
  if (!STACKS.includes(stack)) die(`Unknown stack "${stack}". Available: ${STACKS.join(", ")}`);

  const installed = fs.existsSync(path.join(target, ".claude", "kit.config.json"));
  if (installed && !update) {
    const cur = readJson(path.join(target, ".claude", "kit.config.json"), {});
    log(`Kit already installed here (stack ${cur.stack || "?"}, version ${cur.kitVersion || "?"}). New files will be added, existing ones kept.`);
    log("Use --update to refresh the kit-owned files (hooks, scripts, kit skills).");
  }

  log(`\nclaude-code-base ${KIT_VERSION} → ${target}  [stack: ${stack}]${dry ? "  (dry run)" : ""}${update ? "  (update)" : ""}\n`);
  const plan = buildPlan(stack);
  const report = { created: [], updated: [], merged: [], kept: [], kitNew: [] };

  for (const [rel, f] of [...plan.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const dest = path.join(target, ...rel.split("/"));
    const content = f.content !== undefined ? f.content : fs.readFileSync(f.src);
    const exists = fs.existsSync(dest);
    const write = (c) => {
      if (dry) return;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, c);
      if ((f.mode && (f.mode & 0o111)) || rel.startsWith(".githooks/")) fs.chmodSync(dest, 0o755);
    };

    if (!exists) {
      write(content);
      report.created.push(rel);
      continue;
    }
    const current = fs.readFileSync(dest, "utf8");
    const text = typeof content === "string" ? content : content.toString("utf8");
    if (same(current, text)) continue;

    // JSON files are merged, never replaced.
    if (f.json) {
      const cur = readJson(dest, null);
      if (!cur) {
        report.kept.push(`${rel} (invalid JSON, left alone)`);
        continue;
      }
      const fresh = JSON.parse(text);
      const merged =
        f.json === "kitConfig" ? (update ? refreshKitConfig(fresh, cur) : cur) :
        f.json === "settings" ? mergeSettings(cur, fresh) :
        mergeKitSkills(cur, fresh);
      const out = JSON.stringify(merged, null, 2) + "\n";
      if (!same(out, current)) {
        write(out);
        report.merged.push(rel);
      }
      continue;
    }
    // CLAUDE.md / AGENTS.md made by a framework generator: append ours once.
    if ((rel === "CLAUDE.md" || rel === "AGENTS.md") && !current.includes(MARK)) {
      const block = `\n\n<!-- ${MARK} -->\n${rel === "CLAUDE.md" ? text.replace(/^@AGENTS\.md\s*/m, current.includes("@AGENTS.md") ? "" : "@AGENTS.md\n") : text.replace(/^# AGENTS\.md\s*/m, "## Project facts\n\n")}`;
      write(current.trimEnd() + block);
      report.merged.push(`${rel} (kit section appended)`);
      continue;
    }
    if (update && isKitOwned(rel)) {
      write(content);
      report.updated.push(rel);
      continue;
    }
    if (update) {
      if (!dry) fs.writeFileSync(dest + ".kit-new", content);
      report.kitNew.push(rel + ".kit-new");
      continue;
    }
    report.kept.push(rel);
  }

  // .gitignore
  const gi = path.join(target, ".gitignore");
  const giText = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const block = GITIGNORE_BLOCK(stack);
  const re = new RegExp(`# >>> ${MARK}[\\s\\S]*?# <<< ${MARK}`);
  const nextGi = re.test(giText) ? giText.replace(re, block) : (giText.trimEnd() ? giText.trimEnd() + "\n\n" : "") + block + "\n";
  if (nextGi !== giText) {
    if (!dry) fs.writeFileSync(gi, nextGi);
    report.merged.push(".gitignore");
  }

  // git hooks
  let gitNote = "";
  if (fs.existsSync(path.join(target, ".git"))) {
    if (opt("no-githooks")) gitNote = "git hooks: skipped (--no-githooks)";
    else {
      const cur = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: target, encoding: "utf8" }).stdout.trim();
      if (cur && cur !== ".githooks") gitNote = `git hooks: core.hooksPath is already "${cur}", left alone. Add .githooks/pre-commit to it yourself.`;
      else if (!cur) {
        if (!dry) spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: target });
        gitNote = "git hooks: core.hooksPath = .githooks (pre-commit runs quick checks)";
      } else gitNote = "git hooks: already active";
    }
  } else gitNote = "git: not a repository yet. Run `git init`, then rerun init (or: git config core.hooksPath .githooks).";

  // report
  const section = (title, list) => list.length && log(`${title} (${list.length})\n${list.map((x) => "  " + x).join("\n")}\n`);
  section("Created", report.created);
  section("Updated (kit-owned)", report.updated);
  section("Merged", report.merged);
  section("Kept your version", report.kept);
  section("Your file differs from the new kit version; compare and delete the .kit-new copy", report.kitNew);
  log(gitNote);

  if (opt("with-skills") && !dry) {
    log("\nInstalling skills (skills.sh CLI)...");
    const r = spawnSync(process.execPath, [path.join(target, ".claude", "scripts", "skills.mjs"), "install"], { cwd: target, stdio: "inherit" });
    if (r.status !== 0) log("Skill install reported a problem. Rerun later: node .claude/scripts/skills.mjs install");
  }

  log(`
Next steps
  1. ${opt("with-skills") ? "Skills installed above." : "Install the skills:  node .claude/scripts/skills.mjs install"}
  2. Start Claude Code in this folder:  claude
  3. /setup-matt-pocock-skills   → choose "local markdown" issue tracker (.scratch/)
  4. /kit-setup                  → database, package manager, AGENTS.md
  5. /grill-with-docs <your idea> → /to-spec → /to-tickets → /scope-lock 01 → APPROVE → /implement
  6. Commit:  git add -A && git commit -m "chore: add claude-code-base kit"
`);
}

// ---------------------------------------------------------------- doctor
function doctor() {
  const cfgPath = path.join(target, ".claude", "kit.config.json");
  const checks = [];
  const add = (ok, label, hint = "") => checks.push([ok, label, hint]);
  const major = Number(process.versions.node.split(".")[0]);
  add(major >= 18, `Node ${process.versions.node}`, "Node 18+ is required by the hooks");
  add(fs.existsSync(cfgPath), "Kit installed (.claude/kit.config.json)", "run: init --stack <nextjs|laravel>");
  const cfg = readJson(cfgPath, {});
  if (cfg.kitVersion) add(cfg.kitVersion === KIT_VERSION, `Kit version ${cfg.kitVersion}`, `this installer is ${KIT_VERSION}: run init --update`);
  const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: target, encoding: "utf8" });
  add(git.status === 0, "Git repository", "git init (Matt's /code-review and /implement need git)");
  if (git.status === 0) {
    const hp = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: target, encoding: "utf8" }).stdout.trim();
    add(hp === ".githooks", "pre-commit hook active", "git config core.hooksPath .githooks");
  }
  const agents = fs.existsSync(path.join(target, "AGENTS.md")) ? fs.readFileSync(path.join(target, "AGENTS.md"), "utf8") : "";
  const nf = (agents.match(/NOT FILLED/g) || []).length;
  add(agents && nf === 0, `AGENTS.md filled${nf ? ` (${nf} NOT FILLED left)` : ""}`, "run /kit-setup in Claude Code");
  add(fs.existsSync(path.join(target, ".claude", "rules", "database.md")), "Database rules active", "/kit-setup or: node .claude/scripts/setup.mjs db <provider>");
  add(fs.existsSync(path.join(target, "docs", "agents", "issue-tracker.md")), "Matt's skills configured (docs/agents/)", "run /setup-matt-pocock-skills");
  const skills = fs.existsSync(path.join(target, ".claude", "scripts", "skills.mjs"))
    ? spawnSync(process.execPath, [path.join(target, ".claude", "scripts", "skills.mjs"), "list"], { cwd: target, encoding: "utf8" })
    : { stdout: "", status: 1 };
  const missing = (skills.stdout.match(/^MISSING REQUIRED: (.*)$/m) || [])[1];
  add(skills.status === 0 && !missing, `Required skills installed${missing ? ` (missing: ${missing})` : ""}`, "node .claude/scripts/skills.mjs install");
  add(fs.existsSync(path.join(target, "node_modules", "@playwright", "test")), "Playwright installed", "npm i -D @playwright/test && npx playwright install chromium");

  log(`\nclaude-code-base doctor → ${target}\n`);
  for (const [ok, label, hint] of checks) log(`${ok ? "✔" : "✖"} ${label}${ok ? "" : `\n    → ${hint}`}`);
  log("");
  process.exit(checks.every(([ok]) => ok) ? 0 : 1);
}

// ---------------------------------------------------------------- main
if (cmd === "init") init();
else if (cmd === "doctor") doctor();
else {
  log(`claude-code-base ${KIT_VERSION}

Usage
  init   [--stack ${STACKS.join("|")}] [--target <dir>] [--dry-run] [--update] [--with-skills] [--no-githooks]
  doctor [--target <dir>]

Examples
  npx -y github:bagasalfanto/claude-code-base init --stack nextjs
  node ../claude-code-base/bin/init.mjs init --stack laravel --target .`);
}
