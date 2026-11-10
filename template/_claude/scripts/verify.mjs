#!/usr/bin/env node
// Runs every check configured in .claude/kit.config.json -> "verify", records the result for the Stop gate,
// and counts failing rounds per scope (max kit.config.json -> maxTestRounds, default 3).
//
//   node .claude/scripts/verify.mjs            all steps (lint, typecheck, unit, build, e2e incl. all buttons)
//   node .claude/scripts/verify.mjs --quick    skip steps marked "full" (build, e2e)
//   node .claude/scripts/verify.mjs --only e2e run one step by name
//   node .claude/scripts/verify.mjs --quick --hook   used by .githooks/pre-commit: never touches the
//                                                    gate state or round counter; passes if nothing is set up yet
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findRoot, loadConfig, loadVerify, loadScope, writeJson, statePath, now } from "../hooks/lib.mjs";

const root = findRoot(process.cwd());
const cfg = loadConfig(root);
const argv = process.argv.slice(2);
const quick = argv.includes("--quick");
const hookMode = argv.includes("--hook");
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx !== -1 ? argv[onlyIdx + 1] : null;
const max = Number(cfg.maxTestRounds) || 3;

let pkgScripts = {};
try {
  pkgScripts = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts || {};
} catch {}

function applies(when) {
  if (!when || when === "always") return true;
  // "a|b" = a OR b, "a&b" = a AND b (AND binds tighter)
  const one = (w) => {
    const [kind, ...rest] = w.split(":");
    const val = rest.join(":");
    if (kind === "script") return Boolean(pkgScripts[val]);
    if (kind === "file") return fs.existsSync(path.join(root, val));
    return false;
  };
  return String(when)
    .split("|")
    .some((alt) => alt.split("&").every(one));
}

const steps = (cfg.verify || []).filter((s) => (only ? s.name === only : !(quick && s.full)));
if (!steps.length) {
  console.log("VERIFY: no steps. Fill in kit.config.json -> verify (run /kit-setup).");
  process.exit(hookMode ? 0 : 1);
}

const results = [];
for (const s of steps) {
  if (!applies(s.when)) {
    console.log(`SKIP  ${s.name}  (${s.when} not found)`);
    results.push({ name: s.name, status: "SKIP" });
    continue;
  }
  const t0 = Date.now();
  process.stdout.write(`RUN   ${s.name}: ${s.run}\n`);
  const r = spawnSync(s.run, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: (s.timeoutSec || 600) * 1000,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  const status = ok ? "PASS" : r.error && r.error.code === "ETIMEDOUT" ? "TIMEOUT" : "FAIL";
  console.log(`${status.padEnd(5)} ${s.name}  (${(ms / 1000).toFixed(1)}s)`);
  if (!ok) {
    const outText = `${r.stdout || ""}\n${r.stderr || ""}`.trim().split(/\r?\n/);
    console.log(outText.slice(-80).map((l) => `      | ${l}`).join("\n"));
  }
  results.push({ name: s.name, status, ms, exit: r.status });
}

const failed = results.filter((r) => r.status === "FAIL" || r.status === "TIMEOUT");
const ran = results.filter((r) => r.status !== "SKIP");
const ok = failed.length === 0 && ran.length > 0;

const prev = loadVerify(root);
const scopeState = loadScope(root);
const slug = scopeState.status === "approved" ? scopeState.slug : null;
const t = now();
const sameScope = prev.scope === slug;
const uiSteps = cfg.uiTestSteps || ["e2e"];
const uiPassed = results.some((r) => uiSteps.includes(r.name) && r.status === "PASS");
const state = {
  lastRunAt: t,
  lastPassAt: ok && !quick && !only ? t : prev.lastPassAt || 0,
  ok,
  lastUiPassAt: ok && uiPassed ? t : prev.lastUiPassAt || 0,
  round: ok ? 0 : (sameScope ? prev.round || 0 : 0) + 1,
  scope: slug,
  quick,
  only,
  steps: results,
};
// A partial run (--quick/--only) proves less: it only counts as PASS for the gate when nothing "full" exists.
if (ok && (quick || only)) {
  const hasFull = (cfg.verify || []).some((s) => s.full && applies(s.when));
  if (!hasFull) state.lastPassAt = t;
}
if (!hookMode) writeJson(statePath(root, "verify.json"), state);

if (!ran.length && hookMode) {
  console.log("VERIFY: nothing to check yet (no lint/typecheck/test set up). Commit allowed.");
  process.exit(0);
}
if (!ran.length) {
  console.log("VERIFY: FAIL (every step was SKIP: nothing was actually tested)");
  process.exit(1);
}
if (ok) {
  console.log(`VERIFY: PASS (${ran.length} step${ran.length === 1 ? "" : "s"}${quick || only ? ", partial" : ""})`);
  if (hookMode) process.exit(0);
  if ((quick || only) && state.lastPassAt !== t) console.log("Note: partial run. Run without --quick/--only before closing the scope.");
  process.exit(0);
}
if (hookMode) {
  console.log(`VERIFY: FAIL (${failed.map((f) => f.name).join(", ")})`);
  process.exit(1);
}
console.log(`VERIFY: FAIL (${failed.map((f) => f.name).join(", ")}) - round ${state.round}/${max}`);
if (state.round >= max) console.log("Round limit reached: stop fixing and report to the user.");
process.exit(1);
