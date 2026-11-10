#!/usr/bin/env node
// Scope lifecycle CLI.
// Claude may run:  status | list | propose <card.md> | done
// User only (the bash guard blocks Claude from these): approve | scope-add <glob...> | off | on | reset
//
// A "scope card" is a small markdown file the scope-lock skill writes under .scratch/:
//   .scratch/<feature>/scope/<NN>-<slug>.md   for a ticket from /to-tickets
//   .scratch/quick/<slug>.md                  for a small change or bug fix without tickets
// Matt's specs and tickets deliberately contain no file paths; the card is where paths get pinned,
// at the moment the work starts, and the user approves them by typing APPROVE.
import fs from "node:fs";
import path from "node:path";
import {
  findRoot, loadConfig, loadScope, saveScope, loadVerify, loadEdits, parseSpecScope,
  readJson, writeJson, statePath, now, toRel,
} from "../hooks/lib.mjs";

const root = findRoot(process.cwd());
const cfg = loadConfig(root);
const [cmd, ...args] = process.argv.slice(2);

const REQUIRED = [
  [/^#{1,3}\s*goal/im, "## Goal"],
  [/^#{1,3}\s*acceptance\s*criteria/im, "## Acceptance criteria"],
  [/^#{1,3}\s*scope\s*files?/im, "## Scope files"],
  [/^#{1,3}\s*test\s*seams?/im, "## Test seams"],
  [/^#{1,3}\s*out\s*of\s*scope/im, "## Out of scope"],
  [/^#{1,3}\s*open\s*questions/im, "## Open questions"],
];

function fail(msg) {
  console.error(`SCOPE: ${msg}`);
  process.exit(1);
}

function section(text, re) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return [];
  const body = [];
  for (const l of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(l)) break;
    body.push(l);
  }
  return body;
}

function openQuestions(text) {
  return section(text, /^#{1,3}\s*open\s*questions/i)
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, ""))
    .filter((l) => !/^(none|no|-|n\/a|nothing)\.?$/i.test(l) && !/^~~.*~~$/.test(l) && !/^\[x\]/i.test(l));
}

function slugFromCard(rel) {
  return rel
    .replace(/^\.scratch\//, "")
    .replace(/\/scope\//, "/")
    .replace(/\.md$/i, "");
}

function setTicketStatus(ticketRel, status) {
  const file = path.join(root, ticketRel);
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, "utf8");
  const re = /^(\s*(?:\*\*)?Status:(?:\*\*)?\s*).*$/im;
  if (!re.test(text)) return false;
  fs.writeFileSync(file, text.replace(re, `$1${status}`));
  return true;
}

function status() {
  const s = loadScope(root);
  const v = loadVerify(root);
  const e = loadEdits(root);
  const mode = readJson(statePath(root, "mode.json"), { gate: "on" });
  console.log(`Status   : ${s.status}${s.slug ? ` (${s.slug})` : ""}`);
  if (s.card) console.log(`Card     : ${s.card}`);
  if (s.ticket) console.log(`Ticket   : ${s.ticket}`);
  if (s.scope) console.log(`Scope    : ${s.scope.join(", ") || "(empty)"}`);
  console.log(`Gate     : ${mode.gate === "off" ? "OFF (GATE OFF)" : "ON"}`);
  console.log(`Verify   : ${v.ok === null || v.ok === undefined ? "none yet" : v.ok ? "PASS" : "FAIL"} | failed rounds ${v.round || 0}/${cfg.maxTestRounds || 3}`);
  console.log(`Untested : ${(e.lastCodeEditAt || 0) > (v.lastPassAt || 0) ? "YES, code changed after the last PASS" : "no"}`);
  if (cfg.requireUiTests !== false) console.log(`UI tested: ${(e.lastUiEditAt || 0) > (v.lastUiPassAt || 0) ? "NO, UI changed after the last browser test PASS" : "yes"}`);
}

switch (cmd) {
  case "status":
  case undefined:
    status();
    break;

  case "list": {
    const hist = readJson(statePath(root, "history.json"), []);
    if (!hist.length) console.log("No closed scopes yet.");
    for (const h of hist.slice(-30)) console.log(`${new Date(h.at).toISOString().slice(0, 10)}  ${h.result.padEnd(6)} ${h.slug}${h.ticket ? `  (${h.ticket})` : ""}`);
    break;
  }

  case "propose": {
    if (!args[0]) fail("usage: scope.mjs propose <path to scope card under .scratch/>");
    const rel = toRel(root, path.resolve(root, args[0]));
    if (rel === null || !rel.startsWith(".scratch/")) fail("the scope card must live under .scratch/ (e.g. .scratch/<feature>/scope/01-<slug>.md or .scratch/quick/<slug>.md).");
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) fail(`${rel} does not exist. The scope-lock skill writes it first.`);
    const cur = loadScope(root);
    const slug = slugFromCard(rel);
    if (cur.status === "approved" && cur.slug !== slug) fail(`scope "${cur.slug}" is still active. Close it (scope.mjs done) or ask the user to type CANCEL.`);

    const text = fs.readFileSync(file, "utf8");
    const missing = REQUIRED.filter(([re]) => !re.test(text)).map(([, h]) => h);
    if (missing.length) fail(`card is incomplete, missing sections: ${missing.join(", ")}`);
    const open = openQuestions(text);
    if (open.length) fail(`there are still ${open.length} open question(s). Ask the user and write the answers into the card first:\n - ${open.join("\n - ")}`);
    const globs = parseSpecScope(text);
    if (!globs.length) fail('the "## Scope files" section must list globs in backticks, e.g.: - `src/app/login/**`');
    const tooBroad = globs.filter((g) => /[<>]/.test(g) || ["**", "**/*", "*", "src/**", "app/**"].includes(g));
    if (tooBroad.length) fail(`scope contains placeholders or is too broad: ${tooBroad.join(", ")}. Write specific paths.`);
    const prose = text.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    if (/<[^>\n]+>/.test(prose)) fail("card still contains <...> placeholders.");
    const tm = text.match(/^\s*(?:\*\*)?Ticket:(?:\*\*)?\s*`?([^`\s]+)`?/im);
    const ticket = tm && tm[1] !== "none" ? tm[1].replace(/\\/g, "/") : null;
    if (ticket && !fs.existsSync(path.join(root, ticket))) fail(`ticket ${ticket} (from the card's Ticket: line) does not exist.`);

    saveScope(root, { status: "proposed", slug, card: rel, ticket, scope: globs, proposedAt: now() });
    console.log(`Scope "${slug}" proposed.${ticket ? ` Ticket: ${ticket}.` : ""}`);
    console.log(`Files: ${globs.join(", ")}`);
    console.log("Now show the user the card summary and ask them to type APPROVE (or request changes).");
    break;
  }

  case "done": {
    const s = loadScope(root);
    if (s.status !== "approved") fail("there is no approved active scope.");
    const v = loadVerify(root);
    const e = loadEdits(root);
    if (!v.lastPassAt || v.lastPassAt < (s.approvedAt || 0)) fail("no PASS verify run since the scope was approved. Run node .claude/scripts/verify.mjs");
    if ((e.lastCodeEditAt || 0) > v.lastPassAt) fail("code changed after the last PASS. Run verify again.");
    if (cfg.requireUiTests !== false && (e.lastUiEditAt || 0) > (v.lastUiPassAt || 0)) fail("UI files changed but no browser test has passed since. Use the ui-verify skill.");
    const ticketUpdated = s.ticket ? setTicketStatus(s.ticket, "done") : false;
    const hist = readJson(statePath(root, "history.json"), []);
    hist.push({ slug: s.slug, ticket: s.ticket || null, result: "done", at: now(), scope: s.scope });
    writeJson(statePath(root, "history.json"), hist.slice(-200));
    saveScope(root, { status: "none", last: s.slug, at: now() });
    console.log(`Scope "${s.slug}" closed.${ticketUpdated ? ` Ticket ${s.ticket} set to Status: done.` : ""}`);
    console.log("Report to the user: what changed, test results, what was left out. Suggest /clear before the next ticket.");
    break;
  }

  // ----- user-only commands (blocked for Claude by .claude/hooks/bash-guard.mjs) -----
  case "approve": {
    const s = loadScope(root);
    if (s.status !== "proposed") fail("no scope is proposed.");
    saveScope(root, { ...s, status: "approved", approvedAt: now() });
    const prev = readJson(statePath(root, "verify.json"), {});
    writeJson(statePath(root, "verify.json"), { ...prev, ok: null, round: 0, scope: s.slug });
    console.log(`Approved: ${s.slug}`);
    break;
  }
  case "scope-add": {
    const s = loadScope(root);
    if (s.status !== "approved") fail("no active scope.");
    s.scope = [...new Set([...(s.scope || []), ...args])];
    saveScope(root, s);
    console.log(`Scope is now: ${s.scope.join(", ")}`);
    break;
  }
  case "off":
  case "on":
    writeJson(statePath(root, "mode.json"), { gate: cmd, at: now() });
    console.log(`Gate: ${cmd === "off" ? "OFF" : "ON"}`);
    break;
  case "reset":
    for (const n of ["scope.json", "edits.json", "verify.json", "stop.json"]) {
      try {
        fs.unlinkSync(statePath(root, n));
      } catch {}
    }
    console.log("Kit state reset.");
    break;
  default:
    fail(`unknown command: ${cmd}. Use: status | list | propose <card> | done`);
}
