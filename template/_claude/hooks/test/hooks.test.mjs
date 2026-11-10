// Tests for the kit's hooks and scripts. Run from the project root:
//   node --test .claude/hooks/test/hooks.test.mjs
// Each test builds a throwaway project in the OS temp folder, so your real state is never touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOKS = path.join(KIT, "hooks");
const SCRIPTS = path.join(KIT, "scripts");

function makeProject(cfgOverride = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-test-"));
  fs.mkdirSync(path.join(dir, ".claude", "state"), { recursive: true });
  const base = JSON.parse(fs.readFileSync(path.join(KIT, "kit.config.json"), "utf8"));
  fs.writeFileSync(path.join(dir, ".claude", "kit.config.json"), JSON.stringify({ ...base, ...cfgOverride }));
  fs.mkdirSync(path.join(dir, ".scratch", "login", "issues"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".scratch", "login", "scope"), { recursive: true });
  return dir;
}

function hook(name, root, input) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify({ cwd: root, ...input }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  assert.equal(r.status, 0, `hook ${name} exit ${r.status}: ${r.stderr}`);
  return r.stdout ? JSON.parse(r.stdout) : null;
}

function script(name, root, args) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, name), ...args], { cwd: root, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
}

const decision = (o) => o && o.hookSpecificOutput && o.hookSpecificOutput.permissionDecision;
const edit = (root, rel, extra = {}) => ({ tool_name: "Edit", tool_input: { file_path: path.join(root, rel), old_string: "a", new_string: "b", ...extra } });
const read = (root, rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

const TICKET = `# 01: Email login

**What to build:** A user can log in with email and password.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A successful login redirects to /dashboard
`;

const CARD = `# Scope: 01 email login

**Ticket:** .scratch/login/issues/01-email-login.md

## Goal
Users can log in with email and password.

## Acceptance criteria
- A successful login redirects to /dashboard.

## Scope files
- \`src/app/login/**\`
- \`tests/e2e/login*.spec.ts\`

## Test seams
- The login server action (agreed with the user).

## Out of scope
- Google login

## Open questions
- none
`;

function approve(root, card = CARD) {
  fs.writeFileSync(path.join(root, ".scratch/login/issues/01-email-login.md"), TICKET);
  fs.writeFileSync(path.join(root, ".scratch/login/scope/01-email-login.md"), card);
  const r = script("scope.mjs", root, ["propose", ".scratch/login/scope/01-email-login.md"]);
  assert.equal(r.status, 0, r.stderr);
  hook("prompt-gate.mjs", root, { prompt: "APPROVE" });
}

test("scope-guard: no approved scope -> deny code edit, allow .scratch/GLOSSARY/ADR edits", () => {
  const root = makeProject();
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "src/app/page.tsx"))), "deny");
  for (const f of [".scratch/x/spec.md", "GLOSSARY.md", "docs/adr/0001-x.md", "docs/agents/domain.md", "CODING_STANDARDS.md"]) {
    assert.equal(hook("scope-guard.mjs", root, edit(root, f)), null, f);
  }
});

test("scope-guard: protected files and outside project are denied", () => {
  const root = makeProject();
  approve(root);
  for (const f of [".env", ".env.local", ".claude/state/scope.json"]) assert.equal(decision(hook("scope-guard.mjs", root, edit(root, f))), "deny", f);
  assert.notEqual(decision(hook("scope-guard.mjs", root, edit(root, ".env.example"))), "deny");
  assert.equal(decision(hook("scope-guard.mjs", root, { tool_name: "Edit", tool_input: { file_path: path.join(os.tmpdir(), "elsewhere.txt") } })), "deny");
});

test("scope-guard: existing migration denied, new migration allowed", () => {
  const root = makeProject({ migrationGlobs: ["database/migrations/**"] });
  approve(root, CARD.replace("- `tests/e2e/login*.spec.ts`", "- `tests/e2e/login*.spec.ts`\n- `database/migrations/**`"));
  fs.mkdirSync(path.join(root, "database/migrations"), { recursive: true });
  fs.writeFileSync(path.join(root, "database/migrations/2026_01_01_create_users.php"), "<?php");
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "database/migrations/2026_01_01_create_users.php"))), "deny");
  assert.equal(hook("scope-guard.mjs", root, { tool_name: "Write", tool_input: { file_path: path.join(root, "database/migrations/2026_02_01_add_x.php"), content: "<?php" } }), null);
});

test("scope-guard: in-scope allowed, out-of-scope asks; strict bypass mode denies instead", () => {
  const root = makeProject();
  approve(root);
  assert.equal(hook("scope-guard.mjs", root, edit(root, "src/app/login/page.tsx")), null);
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "src/app/dashboard/page.tsx"))), "ask");
  assert.equal(decision(hook("scope-guard.mjs", root, { ...edit(root, "src/app/dashboard/page.tsx"), permission_mode: "bypassPermissions" })), "deny");
});

test("scope-guard: agent folder limits for testers", () => {
  const root = makeProject();
  approve(root);
  assert.equal(hook("scope-guard.mjs", root, { ...edit(root, "tests/e2e/routes.json"), agent_type: "button-tester" }), null);
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "tests/e2e/routes.json"))), "ask");
  assert.equal(decision(hook("scope-guard.mjs", root, { ...edit(root, "src/app/login/page.tsx"), agent_type: "ui-tester" })), "deny");
});

test("scope-guard: adding test.skip is denied, suppressions ask", () => {
  const root = makeProject();
  approve(root);
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "tests/e2e/login.spec.ts", { old_string: "test('x'", new_string: "test.skip('x'" }))), "deny");
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "src/app/login/page.tsx", { old_string: "const a = 1", new_string: "// @ts-ignore\nconst a = 1" }))), "ask");
});

test("bash-guard: deny destructive, ask risky, pass normal; strict bypass turns ask into deny", () => {
  const root = makeProject();
  const run = (command, extra = {}) => decision(hook("bash-guard.mjs", root, { tool_name: "Bash", tool_input: { command }, ...extra }));
  assert.equal(run("git push --force origin main"), "deny");
  assert.equal(run("git reset --hard HEAD~1"), "deny");
  assert.equal(run("cat .env"), "deny");
  assert.equal(run("cat .env.example"), null);
  assert.equal(run("node .claude/scripts/scope.mjs approve"), "deny");
  assert.equal(run("echo {} > .claude/state/scope.json"), "deny");
  assert.equal(run("npm install zod"), "ask");
  assert.equal(run("node .claude/scripts/db.mjs reset"), "ask");
  assert.equal(run("git push origin feat/login"), "ask");
  assert.equal(run("git push origin feat/login", { permission_mode: "bypassPermissions" }), "deny");
  assert.equal(run("npm run lint"), null);
  assert.equal(run("node .claude/scripts/scope.mjs propose .scratch/a.md"), null);
});

test("bash-guard: commit gate blocks commits of unverified code", () => {
  const root = makeProject({ verify: [{ name: "unit", run: "node -e \"process.exit(0)\"" }] });
  approve(root);
  const commit = () => decision(hook("bash-guard.mjs", root, { tool_name: "Bash", tool_input: { command: 'git commit -m "feat: login"' } }));
  assert.equal(commit(), null);
  hook("track-edits.mjs", root, { tool_name: "Edit", tool_input: { file_path: path.join(root, "src/app/login/actions.ts") } });
  assert.equal(commit(), "deny");
  assert.equal(script("verify.mjs", root, []).status, 0);
  assert.equal(commit(), null);
});

test("prompt-gate: APPROVE only a proposed card; ADD SCOPE; CANCEL; GATE OFF/ON", () => {
  const root = makeProject();
  assert.match(hook("prompt-gate.mjs", root, { prompt: "APPROVE" }).hookSpecificOutput.additionalContext, /no scope card/);
  approve(root);
  const s = read(root, ".claude/state/scope.json");
  assert.equal(s.status, "approved");
  assert.equal(s.ticket, ".scratch/login/issues/01-email-login.md");
  assert.deepEqual(s.scope, ["src/app/login/**", "tests/e2e/login*.spec.ts"]);
  hook("prompt-gate.mjs", root, { prompt: "ADD SCOPE src/lib/auth.ts" });
  assert.ok(read(root, ".claude/state/scope.json").scope.includes("src/lib/auth.ts"));
  hook("prompt-gate.mjs", root, { prompt: "CANCEL" });
  assert.equal(read(root, ".claude/state/scope.json").status, "none");
  hook("prompt-gate.mjs", root, { prompt: "GATE OFF" });
  assert.equal(hook("scope-guard.mjs", root, edit(root, "src/app/page.tsx")), null);
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, ".env"))), "deny");
  hook("prompt-gate.mjs", root, { prompt: "GATE ON" });
  assert.equal(decision(hook("scope-guard.mjs", root, edit(root, "src/app/page.tsx"))), "deny");
  const o = hook("prompt-gate.mjs", root, { prompt: "please build a login page" });
  assert.ok(o.hookSpecificOutput.additionalContext.length < 600);
});

test("scope propose: rejects open questions, placeholders, too-broad scope, cards outside .scratch", () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, ".scratch/login/issues/01-email-login.md"), TICKET);
  const p = (card) => {
    fs.writeFileSync(path.join(root, ".scratch/login/scope/x.md"), card);
    return script("scope.mjs", root, ["propose", ".scratch/login/scope/x.md"]);
  };
  assert.match(p(CARD.replace("- none", "- Which button color?")).stderr, /open question/);
  assert.match(p(CARD.replace("Users can log in", "<fill in goal>")).stderr, /placeholder/);
  assert.match(p(CARD.replace("- `src/app/login/**`", "- `src/**`")).stderr, /too broad/);
  assert.match(p(CARD.replace("## Test seams", "## Seams")).stderr, /Test seams/);
  fs.writeFileSync(path.join(root, "card.md"), CARD);
  assert.match(script("scope.mjs", root, ["propose", "card.md"]).stderr, /\.scratch/);
});

test("stop-gate + verify + done: rounds, UI gate, ticket status", () => {
  const root = makeProject({
    maxTestRounds: 3,
    uiGlobs: ["src/app/**/*.tsx"],
    verify: [
      { name: "unit", run: `node -e "process.exit(require('fs').existsSync('ok') ? 0 : 1)"` },
      { name: "e2e", run: `node -e "process.exit(0)"`, when: "file:ui-ready" },
    ],
  });
  approve(root);
  hook("track-edits.mjs", root, { tool_name: "Edit", tool_input: { file_path: path.join(root, "src/app/login/page.tsx") } });
  let o = hook("stop-gate.mjs", root, { stop_hook_active: false });
  assert.equal(o.decision, "block");
  assert.match(o.reason, /verify\.mjs/);
  for (let i = 1; i <= 3; i++) assert.match(script("verify.mjs", root, []).stdout, new RegExp(`round ${i}/3`));
  o = hook("stop-gate.mjs", root, { stop_hook_active: false });
  assert.match(o.reason, /STOP fixing/);
  assert.equal(hook("stop-gate.mjs", root, { stop_hook_active: true }), null);
  // fix the unit test; e2e is still skipped -> UI gate
  fs.writeFileSync(path.join(root, "ok"), "");
  assert.equal(script("verify.mjs", root, []).status, 0);
  o = hook("stop-gate.mjs", root, { stop_hook_active: false });
  assert.match(o.reason, /UI GATE/);
  assert.match(o.reason, /SKIPPED/);
  assert.equal(script("scope.mjs", root, ["done"]).status, 1);
  // browser tests available and passing
  fs.writeFileSync(path.join(root, "ui-ready"), "");
  assert.equal(script("verify.mjs", root, []).status, 0);
  assert.equal(hook("stop-gate.mjs", root, { stop_hook_active: false }), null);
  const done = script("scope.mjs", root, ["done"]);
  assert.equal(done.status, 0, done.stderr);
  assert.match(fs.readFileSync(path.join(root, ".scratch/login/issues/01-email-login.md"), "utf8"), /\*\*Status:\*\* done/);
});

test("verify: --quick never counts as a full PASS; --hook leaves gate state alone", () => {
  const root = makeProject({
    verify: [
      { name: "lint", run: `node -e "process.exit(0)"` },
      { name: "build", run: `node -e "process.exit(1)"`, full: true },
    ],
  });
  approve(root);
  hook("track-edits.mjs", root, { tool_name: "Edit", tool_input: { file_path: path.join(root, "src/app/login/a.ts") } });
  assert.equal(script("verify.mjs", root, ["--quick"]).status, 0);
  assert.equal(decision(hook("bash-guard.mjs", root, { tool_name: "Bash", tool_input: { command: "git commit -m x" } })), "deny");
  const before = fs.readFileSync(path.join(root, ".claude/state/verify.json"), "utf8");
  assert.equal(script("verify.mjs", root, ["--hook"]).status, 1);
  assert.equal(fs.readFileSync(path.join(root, ".claude/state/verify.json"), "utf8"), before);
  const empty = makeProject({ verify: [{ name: "lint", run: "x", when: "script:lint" }] });
  assert.equal(script("verify.mjs", empty, ["--quick", "--hook"]).status, 0);
  assert.equal(script("verify.mjs", empty, []).status, 1);
});

test("stop-gate: doc/.scratch edits alone do not require tests", () => {
  const root = makeProject();
  hook("track-edits.mjs", root, { tool_name: "Write", tool_input: { file_path: path.join(root, ".scratch/login/spec.md") } });
  hook("track-edits.mjs", root, { tool_name: "Write", tool_input: { file_path: path.join(root, "GLOSSARY.md") } });
  assert.equal(hook("stop-gate.mjs", root, { stop_hook_active: false }), null);
});

test("session-start: status card reports missing skills", () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, ".claude/kit-skills.json"), JSON.stringify({ sources: [{ source: "mattpocock/skills", required: true, skills: ["tdd"] }] }));
  const o = hook("session-start.mjs", root, {});
  assert.match(o.hookSpecificOutput.additionalContext, /Skills missing: tdd/);
});

test("lib: Windows paths, globs and negation", async () => {
  const { toRel, matchAny } = await import(path.join(HOOKS, "lib.mjs"));
  assert.equal(toRel("E:\\ai\\proj", "E:\\ai\\proj\\src\\app\\page.tsx"), "src/app/page.tsx");
  assert.equal(toRel("E:\\ai\\proj", "e:\\AI\\proj\\src\\x.ts"), "src/x.ts");
  assert.equal(toRel("E:\\ai\\proj", "E:\\ai\\other\\x.ts"), null);
  assert.ok(matchAny("src/app/login/page.tsx", ["{src/,}app/**/*.{tsx,jsx,css}"]));
  assert.ok(matchAny(".env.local", [".env", ".env.*", "!.env.example"]));
  assert.ok(!matchAny(".env.example", [".env", ".env.*", "!.env.example"]));
  assert.ok(matchAny("src/billing/GLOSSARY.md", ["**/GLOSSARY.md"]));
});
