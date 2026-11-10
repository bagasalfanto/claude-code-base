// UserPromptSubmit — the ONLY way a scope gets approved is the user typing a command in the prompt,
// which Claude cannot do for itself:
//   APPROVE              approve the proposed scope card (scope = globs in its "Scope files" section)
//   CANCEL               cancel the proposed/active scope
//   ADD SCOPE <glob>     add path glob(s) to the active scope
//   GATE OFF / GATE ON   turn the scope gate off/on for this project (tests stay mandatory)
// Every other prompt gets a short reminder of the working rules (about 60 tokens).
import fs from "node:fs";
import path from "node:path";
import { runHook, loadConfig, loadScope, saveScope, parseSpecScope, addContext, writeJson, statePath, readJson, now } from "./lib.mjs";

runHook(async (input, root) => {
  const prompt = String(input.prompt || "").trim();
  const cur = loadScope(root);
  const mode = readJson(statePath(root, "mode.json"), { gate: "on" });
  const maxRounds = Number(loadConfig(root).maxTestRounds) || 3;

  if (/^APPROVE\b/i.test(prompt)) {
    if (cur.status !== "proposed") {
      return addContext("UserPromptSubmit", `[kit] The user typed APPROVE, but no scope card is proposed (status: ${cur.status}). Tell the user.`);
    }
    let globs = cur.scope || [];
    try {
      globs = parseSpecScope(fs.readFileSync(path.join(root, cur.card || ""), "utf8"));
    } catch {}
    const next = { ...cur, status: "approved", approvedAt: now(), scope: globs };
    saveScope(root, next);
    const prev = readJson(statePath(root, "verify.json"), {});
    writeJson(statePath(root, "verify.json"), { ...prev, ok: null, round: 0, scope: next.slug });
    const ticket = next.ticket ? ` Ticket: ${next.ticket}.` : "";
    return addContext(
      "UserPromptSubmit",
      `[kit] The user APPROVED scope "${next.slug}" (card: ${next.card}).${ticket} Scope files: ${globs.join(", ") || "(empty: every edit will be asked)"}. Build it with /implement (tdd at the agreed seams; db-change for schema; ui-verify for UI), run node .claude/scripts/verify.mjs, max ${maxRounds} failed rounds, then node .claude/scripts/scope.mjs done.`,
    );
  }

  if (/^CANCEL\b/i.test(prompt)) {
    saveScope(root, { status: "none", cancelled: cur.slug || null, at: now() });
    return addContext("UserPromptSubmit", `[kit] The user cancelled scope "${cur.slug || "-"}". Do not continue changes for it.`);
  }

  const add = prompt.match(/^ADD\s+SCOPE\s+(.+)$/i);
  if (add) {
    if (cur.status !== "approved") return addContext("UserPromptSubmit", "[kit] ADD SCOPE ignored: no scope is approved.");
    const globs = add[1].split(/[\s,]+/).map((s) => s.replace(/^`|`$/g, "")).filter(Boolean);
    cur.scope = [...new Set([...(cur.scope || []), ...globs])];
    saveScope(root, cur);
    return addContext("UserPromptSubmit", `[kit] Scope "${cur.slug}" extended with: ${globs.join(", ")}. Also add them to the "Scope files" section of ${cur.card}.`);
  }

  if (/^GATE\s+OFF\b/i.test(prompt)) {
    writeJson(statePath(root, "mode.json"), { gate: "off", at: now() });
    return addContext("UserPromptSubmit", "[kit] The user turned the scope gate OFF. Still ask about unclear details and still run tests before finishing.");
  }
  if (/^GATE\s+ON\b/i.test(prompt)) {
    writeJson(statePath(root, "mode.json"), { gate: "on", at: now() });
    return addContext("UserPromptSubmit", "[kit] The user turned the scope gate back ON.");
  }

  const active =
    cur.status === "approved"
      ? `Active scope: "${cur.slug}" (${(cur.scope || []).join(", ") || "-"}).`
      : cur.status === "proposed"
        ? `Scope "${cur.slug}" is waiting for the user to type APPROVE.`
        : "No active scope.";
  addContext(
    "UserPromptSubmit",
    `[kit] ${active} Gate: ${mode.gate === "off" ? "OFF" : "ON"}. Ask about unclear details first; never invent data, field names, UI copy, or numbers. Change only files inside the scope.`,
  );
});
