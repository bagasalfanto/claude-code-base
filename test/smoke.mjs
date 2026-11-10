// End-to-end smoke test for the installer: node test/smoke.mjs
// Installs the kit into throwaway Next.js and Laravel projects and checks the result.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INIT = path.join(KIT, "bin", "init.mjs");
const run = (args, cwd) => spawnSync(process.execPath, [INIT, ...args], { cwd, encoding: "utf8" });
const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: cwd } });
const has = (dir, rel) => fs.existsSync(path.join(dir, rel));
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
let passed = 0;
const step = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

function project(kind) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ccb-${kind}-`));
  if (kind === "nextjs") {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "app", scripts: { lint: "next lint" }, dependencies: { next: "16.0.0" } }));
    // newer create-next-app versions ship their own AGENTS.md / CLAUDE.md
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# Next.js agent notes\n\nUse the App Router.\n");
  } else {
    fs.writeFileSync(path.join(dir, "composer.json"), JSON.stringify({ require: { "laravel/framework": "^12.0" } }));
    fs.writeFileSync(path.join(dir, ".gitignore"), "/vendor\n");
  }
  spawnSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

for (const stack of ["nextjs", "laravel"]) {
  const dir = project(stack);

  step(`${stack}: dry run changes nothing`, () => {
    const r = run(["init", "--dry-run"], dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stack: ${stack}`));
    assert.ok(!has(dir, ".claude"));
  });

  step(`${stack}: init (stack auto-detected)`, () => {
    const r = run(["init"], dir);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    for (const f of [
      ".claude/kit.config.json", ".claude/settings.json", ".claude/kit-skills.json", ".claude/state/.gitignore",
      ".claude/hooks/scope-guard.mjs", ".claude/scripts/scope.mjs", ".claude/rules/00-core-rules.md", ".claude/rules/frontend.md",
      ".claude/library/database/supabase.md", ".claude/skills/scope-lock/SKILL.md", ".claude/skills/kit-setup/SKILL.md",
      ".claude/agents/ui-tester.md", ".github/workflows/verify.yml", ".githooks/pre-commit",
      "CLAUDE.md", "AGENTS.md", "CODING_STANDARDS.md", "docs/database.md", "playwright.config.ts",
      "tests/e2e/all-buttons.spec.ts", "tests/e2e/routes.json",
    ]) assert.ok(has(dir, f), `missing ${f}`);
    assert.ok(!has(dir, "_claude") && !has(dir, ".claude/kit.config.json.kit-new"));
    const cfg = JSON.parse(read(dir, ".claude/kit.config.json"));
    assert.equal(cfg.stack, stack);
    assert.ok(cfg.verify.length > 0 && cfg.migrationGlobs.length > 0 && cfg.uiGlobs.length > 0);
    assert.ok(cfg.protected.includes(".env") && cfg.alwaysEditable.includes(".scratch/**"));
    const settings = JSON.parse(read(dir, ".claude/settings.json"));
    assert.ok(settings.hooks.PreToolUse.length >= 2 && settings.permissions.allow.length > 20);
    const skills = JSON.parse(read(dir, ".claude/kit-skills.json"));
    assert.ok(skills.sources.some((s) => s.source === "mattpocock/skills" && s.required));
    assert.match(read(dir, "CODING_STANDARDS.md"), stack === "nextjs" ? /## Next\.js/ : /## Laravel/);
    assert.match(read(dir, ".gitignore"), /# >>> claude-code-base/);
    assert.equal(spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: dir, encoding: "utf8" }).stdout.trim(), ".githooks");
    if (process.platform !== "win32") assert.ok(fs.statSync(path.join(dir, ".githooks/pre-commit")).mode & 0o111, "pre-commit must be executable");
    if (stack === "nextjs") {
      const agents = read(dir, "AGENTS.md");
      assert.match(agents, /Use the App Router\./);
      assert.match(agents, /## Project facts/);
    } else assert.match(read(dir, ".gitignore"), /^\/vendor/m);
  });

  step(`${stack}: second init is a no-op`, () => {
    const before = read(dir, ".gitignore") + read(dir, "AGENTS.md") + read(dir, ".claude/settings.json");
    const r = run(["init"], dir);
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /^Created/m);
    assert.equal(read(dir, ".gitignore") + read(dir, "AGENTS.md") + read(dir, ".claude/settings.json"), before);
  });

  step(`${stack}: --update refreshes kit files, keeps user edits`, () => {
    fs.appendFileSync(path.join(dir, ".claude/hooks/lib.mjs"), "\n// local hack\n");
    fs.appendFileSync(path.join(dir, ".claude/rules/frontend.md"), "\n- my own rule\n");
    const cfgPath = path.join(dir, ".claude/kit.config.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    cfg.maxTestRounds = 2;
    cfg.protected.push("my-secret-folder/**");
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const r = run(["init", "--update"], dir);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(read(dir, ".claude/hooks/lib.mjs"), /local hack/);
    assert.match(read(dir, ".claude/rules/frontend.md"), /my own rule/);
    assert.ok(has(dir, ".claude/rules/frontend.md.kit-new"));
    const after = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    assert.equal(after.maxTestRounds, 2);
    assert.ok(after.protected.includes("my-secret-folder/**") && after.protected.includes(".env"));
  });

  step(`${stack}: hook test suite passes inside the installed project`, () => {
    const r = node(["--test", ".claude/hooks/test/hooks.test.mjs"], dir);
    assert.equal(r.status, 0, r.stdout.slice(-3000));
  });

  step(`${stack}: kit scripts run in the installed project`, () => {
    let r = node([".claude/scripts/scope.mjs", "status"], dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Status\s+: none/);
    r = node([".claude/scripts/setup.mjs", "db", "supabase"], dir);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(has(dir, ".claude/rules/database.md"));
    r = node([".claude/scripts/skills.mjs", "list"], dir);
    assert.match(r.stdout, /MISSING REQUIRED: .*grill-with-docs/);
    r = node([".claude/hooks/session-start.mjs"], dir);
    assert.equal(r.status, 0);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /skills\.mjs install/);
    assert.match(ctx, /setup-matt-pocock-skills/);
  });

  step(`${stack}: doctor reports what is left`, () => {
    const r = run(["doctor", "--target", dir], KIT);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /✔ Kit installed/);
    assert.match(r.stdout, /✔ pre-commit hook active/);
    assert.match(r.stdout, /✖ Required skills installed/);
  });

  fs.rmSync(dir, { recursive: true, force: true });
}

step("explicit --stack and --target into an empty folder", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccb-empty-"));
  const r = run(["init", "--stack", "laravel", "--target", path.join(dir, "new-app")], KIT);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /not a repository yet/);
  assert.equal(JSON.parse(read(path.join(dir, "new-app"), ".claude/kit.config.json")).stack, "laravel");
  fs.rmSync(dir, { recursive: true, force: true });
});

step("no stack detectable -> clear error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccb-none-"));
  const r = run(["init"], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--stack/);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`\n${passed} smoke checks passed`);
