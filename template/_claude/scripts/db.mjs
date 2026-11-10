#!/usr/bin/env node
// Local database helper, one command per job (feedback loop for diagnosing-bugs and e2e).
//   node .claude/scripts/db.mjs status | reset | seed
// Commands come from kit.config.json -> db (set by `setup.mjs db <provider>`).
// LOCAL ONLY. The bash guard asks the user before reset/seed run.
import { spawnSync } from "node:child_process";
import { findRoot, loadConfig } from "../hooks/lib.mjs";

const root = findRoot(process.cwd());
const cfg = loadConfig(root);
const cmd = process.argv[2] || "status";
const db = cfg.db || {};

if (!["status", "reset", "seed"].includes(cmd)) {
  console.error("DB: use status | reset | seed");
  process.exit(1);
}
const run = db[cmd];
if (!run) {
  console.error(`DB: no "${cmd}" command for database "${cfg.database}". ${db.note || "Set kit.config.json -> db." + cmd + " (run /kit-setup)."}`);
  process.exit(1);
}
console.log(`DB ${cmd}: ${run}`);
const r = spawnSync(run, { cwd: root, shell: true, stdio: "inherit" });
process.exit(r.status ?? 1);
