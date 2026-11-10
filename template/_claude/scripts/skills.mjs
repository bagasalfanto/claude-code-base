#!/usr/bin/env node
// Installs / checks the third-party skills this kit is built around (Matt Pocock's skills + extras).
// Skills are NOT bundled in the kit repo; they are copied into .claude/skills/ with the skills.sh CLI.
//   node .claude/scripts/skills.mjs list                  installed vs expected
//   node .claude/scripts/skills.mjs install               everything in .claude/kit-skills.json
//   node .claude/scripts/skills.mjs install --matt        only Matt's set
//   node .claude/scripts/skills.mjs print                 print the npx commands instead of running them
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findRoot, readJson } from "../hooks/lib.mjs";

const root = findRoot(process.cwd());
const manifest = readJson(path.join(root, ".claude", "kit-skills.json"), { sources: [] });
const [cmd = "list", ...flags] = process.argv.slice(2);
const sources = manifest.sources.filter((s) => !flags.includes("--matt") || s.source === "mattpocock/skills");
const installed = (name) => fs.existsSync(path.join(root, ".claude", "skills", name, "SKILL.md"));
const command = (s) => `npx -y skills@latest add ${s.source} ${s.skills.map((n) => `--skill ${n}`).join(" ")} -a claude-code --copy -y`;

if (cmd === "list") {
  for (const s of manifest.sources) {
    console.log(`${s.source}${s.required ? " (required)" : ""}`);
    for (const n of s.skills) console.log(`  ${installed(n) ? "[x]" : "[ ]"} ${n}`);
  }
  const missing = manifest.sources.filter((s) => s.required).flatMap((s) => s.skills).filter((n) => !installed(n));
  if (missing.length) console.log(`MISSING REQUIRED: ${missing.join(", ")}`);
  process.exit(0);
}
if (cmd === "print") {
  for (const s of sources) console.log(command(s));
  process.exit(0);
}
if (cmd === "install") {
  let failed = 0;
  for (const s of sources) {
    const todo = s.skills.filter((n) => !installed(n) || flags.includes("--force"));
    if (!todo.length) {
      console.log(`OK    ${s.source} (already installed)`);
      continue;
    }
    const c = command({ ...s, skills: todo });
    console.log(`RUN   ${c}`);
    const r = spawnSync(c, { cwd: root, shell: true, stdio: "inherit", env: { ...process.env, DO_NOT_TRACK: "1", DISABLE_TELEMETRY: "1" } });
    if (r.status !== 0) failed++;
  }
  const missing = manifest.sources.flatMap((s) => (s.required ? s.skills : [])).filter((n) => !installed(n));
  if (missing.length) console.log(`Still missing required skills: ${missing.join(", ")}`);
  console.log(failed || missing.length ? "SKILLS: incomplete" : "SKILLS: done. Next: open Claude Code and run /setup-matt-pocock-skills, then /kit-setup.");
  process.exit(failed || missing.length ? 1 : 0);
}
console.error("SKILLS: use list | install [--matt] [--force] | print");
process.exit(1);
