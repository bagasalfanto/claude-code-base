// PostToolUse (Edit | Write | MultiEdit | NotebookEdit) — records which files changed and when, so the
// Stop gate knows whether a passing test run (and a passing browser test for UI files) happened AFTER the last edit.
import { runHook, loadConfig, loadEdits, toRel, matchAny, writeJson, statePath, now } from "./lib.mjs";

runHook(async (input, root) => {
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path || ti.path;
  if (!file) return;
  const rel = toRel(root, file);
  if (rel === null) return;
  const cfg = loadConfig(root);
  // Specs and notes are not code: they never require a new test run.
  if (matchAny(rel, cfg.nonCode || [])) return;

  const edits = loadEdits(root);
  const t = now();
  edits.lastCodeEditAt = t;
  if (matchAny(rel, cfg.uiGlobs || [])) edits.lastUiEditAt = t;
  const files = new Map((edits.files || []).map((e) => [e.path, e]));
  files.set(rel, { path: rel, at: t, agent: input.agent_type || "main" });
  edits.files = [...files.values()].slice(-200);
  writeJson(statePath(root, "edits.json"), edits);
});
