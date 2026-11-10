// PreToolUse (Edit | Write | MultiEdit | NotebookEdit) — keeps every edit inside the approved scope.
// Order of checks:
//   1. outside the project                                           -> deny
//   2. protected files (.env, lockfiles, kit state, generated)       -> deny
//   3. existing migrations                                           -> deny
//   4. test tampering (.skip/.only/markTestSkipped added to a test)  -> deny
//   5. always-editable paths (.scratch, GLOSSARY, ADRs, docs/agents) -> allow-through
//   6. no approved scope (gate on)                                   -> deny with next steps
//   7. per-agent folder limits (ui-tester, button-tester)            -> deny outside; inside counts as in scope
//   8. file outside the approved scope                               -> ask (deny in strict bypass mode)
//   9. lint/type suppressions added                                  -> ask (deny in strict bypass mode)
import fs from "node:fs";
import path from "node:path";
import { runHook, loadConfig, loadScope, toRel, matchAny, preToolDecision, readJson, statePath, strictBypass } from "./lib.mjs";

const TEST_FILE = /(^|\/)(tests?|__tests__|e2e|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|Test\.php$|_test\.go$/i;
const SKIP_MARKERS = [
  /\b(?:it|test|describe|context|suite)\.(?:skip|only|todo|fixme)\s*\(/,
  /\bx(?:it|describe|test)\s*\(/,
  /markTestSkipped|markTestIncomplete|->skip\(\s*\)|\$this->skip/,
  /@group\s+skip/,
];
const SUPPRESS = /eslint-disable|@ts-ignore|@ts-nocheck|@ts-expect-error|biome-ignore|phpstan-ignore|@phpstan-ignore|psalm-suppress/;

function newText(input) {
  const ti = input.tool_input || {};
  if (typeof ti.content === "string") return ti.content;
  if (typeof ti.new_string === "string") return ti.new_string;
  if (Array.isArray(ti.edits)) return ti.edits.map((e) => e.new_string || "").join("\n");
  if (typeof ti.new_source === "string") return ti.new_source;
  return "";
}
function oldText(input) {
  const ti = input.tool_input || {};
  if (typeof ti.old_string === "string") return ti.old_string;
  if (Array.isArray(ti.edits)) return ti.edits.map((e) => e.old_string || "").join("\n");
  return "";
}
const count = (re, s) => (s.match(new RegExp(re.source, "g")) || []).length;

runHook(async (input, root) => {
  const cfg = loadConfig(root);
  const gateOn = cfg.enforce !== false && readJson(statePath(root, "mode.json"), { gate: "on" }).gate !== "off";
  const strict = strictBypass(input, cfg);
  const askOrDeny = (msg) => preToolDecision(strict ? "deny" : "ask", strict ? `${msg} (Bypass mode: this needs the user's OK, so it is blocked. Ask the user in chat; they can type ADD SCOPE <glob>.)` : msg);

  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path || ti.path;
  if (!file) return;
  const rel = toRel(root, file);

  if (rel === null) {
    return preToolDecision("deny", `SCOPE: ${file} is outside the project folder. Only edit files inside the project.`);
  }
  if (matchAny(rel, cfg.protected)) {
    return preToolDecision(
      "deny",
      `PROTECTED: ${rel} is protected (.env, lockfile, kit state, generated file). Do not change it. If it really must change, explain why to the user and let the user do it.`,
    );
  }
  if (matchAny(rel, cfg.migrationGlobs) && fs.existsSync(path.join(root, rel))) {
    return preToolDecision("deny", `MIGRATION: ${rel} already exists. Existing migrations must NOT be edited. Create a NEW migration (db-change skill).`);
  }

  const added = newText(input);
  const removed = oldText(input);
  if (TEST_FILE.test(rel)) {
    for (const re of SKIP_MARKERS) {
      if (count(re, added) > count(re, removed)) {
        return preToolDecision(
          "deny",
          `TEST INTEGRITY: adding skip/only/fixme to ${rel} is not allowed. Fix the code so the test passes instead of disabling it. If the test itself is wrong, ask the user first.`,
        );
      }
    }
  }

  if (matchAny(rel, cfg.alwaysEditable)) return;

  const scope = loadScope(root);
  if (gateOn && scope.status !== "approved") {
    const pending = scope.status === "proposed" ? ` Scope "${scope.slug}" was proposed but is NOT approved yet: ask the user to type APPROVE.` : "";
    return preToolDecision(
      "deny",
      `SCOPE GATE: no scope has been approved by the user.${pending} Flow: run the scope-lock skill (it writes a scope card under .scratch/ and runs node .claude/scripts/scope.mjs propose <card>), then the user types APPROVE.`,
    );
  }

  const agent = input.agent_type;
  const limits = agent && cfg.agentPaths ? cfg.agentPaths[agent] : undefined;
  if (Array.isArray(limits) && !matchAny(rel, limits)) {
    return preToolDecision(
      "deny",
      `AGENT SCOPE: agent "${agent}" may only change: ${limits.join(", ") || "(nothing / read-only)"}. ${rel} is not its job: report it as OUT OF SCOPE.`,
    );
  }

  // A tester agent's own folders (tests/e2e/**) count as in scope: it can never touch app code anyway.
  const agentOwned = Array.isArray(limits) && limits.length > 0;
  const globs = scope.scope || [];
  if (gateOn && scope.status === "approved" && !agentOwned && !matchAny(rel, globs)) {
    return askOrDeny(`OUT OF SCOPE: ${rel} is not in the scope of "${scope.slug}" (${globs.join(", ") || "empty scope"}). Approve only if this task truly requires it.`);
  }

  if (count(SUPPRESS, added) > count(SUPPRESS, removed)) {
    return askOrDeny(`SUPPRESSION: this edit adds eslint-disable/@ts-ignore/phpstan-ignore to ${rel}. Prefer fixing the root cause.`);
  }
});
