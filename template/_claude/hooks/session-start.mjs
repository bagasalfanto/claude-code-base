// SessionStart — prints a short status card (about 120 tokens): setup state, Matt skills present or not,
// active scope, last test result.
import fs from "node:fs";
import path from "node:path";
import { runHook, loadConfig, loadScope, loadVerify, loadEdits, readJson, statePath, addContext } from "./lib.mjs";

const ago = (t) => {
  if (!t) return "never";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

runHook(async (input, root) => {
  const cfg = loadConfig(root);
  const s = loadScope(root);
  const v = loadVerify(root);
  const e = loadEdits(root);
  const mode = readJson(statePath(root, "mode.json"), { gate: "on" });
  const lines = [];
  const has = (p) => fs.existsSync(path.join(root, p));

  const manifest = readJson(path.join(root, ".claude", "kit-skills.json"), { sources: [] });
  const expected = manifest.sources.flatMap((x) => (x.required ? x.skills : []));
  const missing = expected.filter((n) => !has(`.claude/skills/${n}/SKILL.md`));
  if (missing.length) lines.push(`Skills missing: ${missing.join(", ")}. Tell the user to run: node .claude/scripts/skills.mjs install`);
  if (!has("docs/agents/issue-tracker.md") && !missing.includes("setup-matt-pocock-skills")) lines.push("Matt skills not configured: suggest /setup-matt-pocock-skills.");
  let agents = "";
  try {
    agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  } catch {}
  if (!agents || /NOT FILLED/.test(agents) || cfg.database === "not-selected") lines.push("Stack not set up: suggest /kit-setup.");

  if (s.status === "approved") lines.push(`Active scope: "${s.slug}" (card ${s.card}${s.ticket ? `, ticket ${s.ticket}` : ""}); files: ${(s.scope || []).join(", ") || "-"}.`);
  else if (s.status === "proposed") lines.push(`Scope "${s.slug}" is waiting for the user to type APPROVE.`);
  else lines.push("No active scope. Code changes need the scope-lock skill first.");
  const dirty = (e.lastCodeEditAt || 0) > (v.lastPassAt || 0);
  lines.push(`Last verify: ${v.ok === null || v.ok === undefined ? "none" : v.ok ? "PASS" : `FAIL (round ${v.round}/${cfg.maxTestRounds || 3})`}, ${ago(v.lastRunAt)}.${dirty ? " Untested code changes exist." : ""}`);
  lines.push(`Stack: ${cfg.stack || "?"}; database: ${cfg.database || "?"}; gate: ${mode.gate === "off" ? "OFF" : "ON"}.`);
  addContext("SessionStart", `[kit] ${lines.join(" ")}`);
});
