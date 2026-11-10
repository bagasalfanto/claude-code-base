// Stop — Claude may not finish a turn while:
//   (a) code changed after the last PASSING verify run, or
//   (b) UI files changed after the last PASSING browser test (kit.config.json -> requireUiTests).
// Test loop: max `maxTestRounds` (default 3) failing rounds per scope; after that Claude must stop
// fixing and report the error to the user instead of looping forever.
import { runHook, loadConfig, loadEdits, loadVerify, loadScope, readJson, writeJson, statePath, out } from "./lib.mjs";

function block(root, stop, reason) {
  stop.consecutiveBlocks = (stop.consecutiveBlocks || 0) + 1;
  writeJson(statePath(root, "stop.json"), stop);
  out({ decision: "block", reason });
}

runHook(async (input, root) => {
  const cfg = loadConfig(root);
  if (cfg.enforce === false) return;
  const max = Number(cfg.maxTestRounds) || 3;
  const edits = loadEdits(root);
  const verify = loadVerify(root);
  const scope = loadScope(root);
  const stop = readJson(statePath(root, "stop.json"), { consecutiveBlocks: 0, reportedRunAt: 0 });

  const codeDirty = (edits.lastCodeEditAt || 0) > (verify.lastPassAt || 0);
  const uiDirty = cfg.requireUiTests !== false && (edits.lastUiEditAt || 0) > (verify.lastUiPassAt || 0);
  if (!codeDirty && !uiDirty) {
    if (stop.consecutiveBlocks) writeJson(statePath(root, "stop.json"), { ...stop, consecutiveBlocks: 0 });
    return;
  }
  // Safety valve: never trap Claude in an endless stop loop.
  if (input.stop_hook_active && (stop.consecutiveBlocks || 0) >= 3) {
    writeJson(statePath(root, "stop.json"), { ...stop, consecutiveBlocks: 0 });
    return;
  }

  const name = scope.slug ? `scope "${scope.slug}"` : "this change";
  const testedAfterEdit = (verify.lastRunAt || 0) >= (edits.lastCodeEditAt || 0);

  if (!codeDirty && uiDirty) {
    const e2e = (verify.steps || []).find((s) => (cfg.uiTestSteps || ["e2e"]).includes(s.name));
    const why = e2e && e2e.status === "SKIP" ? " The e2e step was SKIPPED (Playwright not installed?). Tell the user UI is untested and how to install Playwright." : "";
    return block(root, stop, `UI GATE: UI files for ${name} changed but no browser test has passed since. Use the ui-verify skill (ui-tester + button-tester), then run node .claude/scripts/verify.mjs.${why}`);
  }

  if (!testedAfterEdit) {
    return block(
      root,
      stop,
      `QUALITY GATE: code for ${name} changed after the last test run. Run: node .claude/scripts/verify.mjs (round ${Math.min((verify.round || 0) + 1, max)}/${max}). UI changes also need the ui-verify skill. Do not say it is done before PASS.`,
    );
  }

  if ((verify.round || 0) >= max) {
    if (stop.reportedRunAt === verify.lastRunAt) return; // already told to report: let it stop
    stop.reportedRunAt = verify.lastRunAt;
    return block(
      root,
      stop,
      `QUALITY GATE: ${max} test rounds have failed for ${name}. STOP fixing. Report to the user: the last error (quote the output), the likely cause, the files involved, and 2-3 options. Ask the user which one to take.`,
    );
  }
  return block(
    root,
    stop,
    `QUALITY GATE: tests failed (round ${verify.round}/${max}) for ${name}. Use the diagnosing-bugs skill: build a loop that goes red on this failure, find the root cause, fix it ONLY inside the scope, then run again: node .claude/scripts/verify.mjs`,
  );
});
