#!/usr/bin/env node
// Project setup helper used by the /kit-setup skill.
//   node .claude/scripts/setup.mjs detect             print what the project already has
//   node .claude/scripts/setup.mjs db <supabase|mysql|turso|firebase>
//                                                     activate one database rule (library -> rules/database.md)
//   node .claude/scripts/setup.mjs pm <npm|pnpm|yarn|bun>   switch the package manager in verify commands
//   node .claude/scripts/setup.mjs axe <on|off>              accessibility check in the all-buttons test
import fs from "node:fs";
import path from "node:path";
import { findRoot, loadConfig, writeJson } from "../hooks/lib.mjs";

const root = findRoot(process.cwd());
const cfgPath = path.join(root, ".claude", "kit.config.json");
const cfg = loadConfig(root);
const [cmd, arg] = process.argv.slice(2);
const exists = (p) => fs.existsSync(path.join(root, p));
const DBS = ["supabase", "mysql", "turso", "firebase"];

function fail(msg) {
  console.error(`SETUP: ${msg}`);
  process.exit(1);
}

if (cmd === "detect" || !cmd) {
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {}
  let composer = {};
  try {
    composer = JSON.parse(fs.readFileSync(path.join(root, "composer.json"), "utf8"));
  } catch {}
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const cdeps = { ...(composer.require || {}), ...(composer["require-dev"] || {}) };
  const pm = exists("pnpm-lock.yaml") ? "pnpm" : exists("yarn.lock") ? "yarn" : exists("bun.lock") || exists("bun.lockb") ? "bun" : exists("package-lock.json") ? "npm" : "(no lockfile yet)";
  const guessDb = deps["@supabase/supabase-js"] || deps["@supabase/ssr"] || exists("supabase")
    ? "supabase"
    : deps["@libsql/client"]
      ? "turso"
      : deps.firebase || deps["firebase-admin"] || exists("firebase.json") || cdeps["kreait/laravel-firebase"]
        ? "firebase"
        : deps.mysql2 || cdeps["laravel/framework"]
          ? "mysql (guess)"
          : "not detected";
  const lines = [
    `kit stack       : ${cfg.stack}`,
    `kit database    : ${cfg.database}`,
    `package manager : ${pm}`,
    `next            : ${deps.next || "-"}`,
    `react           : ${deps.react || "-"}`,
    `laravel         : ${cdeps["laravel/framework"] || "-"}`,
    `inertia/livewire: ${cdeps["inertiajs/inertia-laravel"] || cdeps["livewire/livewire"] || "-"}`,
    `tailwind        : ${deps.tailwindcss || "-"}`,
    `typescript      : ${deps.typescript || "-"}`,
    `orm             : ${deps["drizzle-orm"] ? "drizzle " + deps["drizzle-orm"] : deps.prisma || deps["@prisma/client"] ? "prisma" : cdeps["laravel/framework"] ? "eloquent" : "-"}`,
    `unit test       : ${deps.vitest ? "vitest" : deps.jest ? "jest" : cdeps["pestphp/pest"] ? "pest" : cdeps["phpunit/phpunit"] ? "phpunit" : "-"}`,
    `playwright      : ${deps["@playwright/test"] || "-"}${exists("playwright.config.ts") ? " (config present)" : " (no config yet)"}`,
    `database guess  : ${guessDb}`,
    `scripts         : ${Object.keys(pkg.scripts || {}).join(", ") || "-"}`,
    `git             : ${exists(".git") ? "yes" : "no (git init recommended)"}`,
  ];
  console.log(lines.join("\n"));
  process.exit(0);
}

if (cmd === "db") {
  if (!DBS.includes(arg)) fail(`choose one of: ${DBS.join(", ")}`);
  const src = path.join(root, ".claude", "library", "database", `${arg}.md`);
  if (!fs.existsSync(src)) fail(`missing ${src}`);
  fs.copyFileSync(src, path.join(root, ".claude", "rules", "database.md"));
  cfg.database = arg;
  cfg.db = (cfg.dbCommands || {})[arg] || {};
  writeJson(cfgPath, cfg);
  console.log(`Active database: ${arg}. Rules installed to .claude/rules/database.md`);
  console.log(`db.mjs commands: ${Object.entries(cfg.db).map(([k, v]) => `${k}=${v}`).join(" | ") || "(none)"}`);
  process.exit(0);
}

if (cmd === "pm") {
  const pms = { npm: ["npm run", "npm test", "npx"], pnpm: ["pnpm run", "pnpm test", "pnpm exec"], yarn: ["yarn run", "yarn test", "yarn"], bun: ["bun run", "bun run test", "bunx"] };
  if (!pms[arg]) fail(`choose one of: ${Object.keys(pms).join(", ")}`);
  const [runCmd, testCmd, exec] = pms[arg];
  cfg.packageManager = arg;
  cfg.verify = (cfg.verify || []).map((s) => ({
    ...s,
    run: s.run
      .replace(/^(npm|pnpm|yarn|bun) run /, `${runCmd} `)
      .replace(/^(npm test|pnpm test|yarn test|bun run test)$/, testCmd)
      .replace(/^(npx|pnpm exec|bunx) /, `${exec} `),
  }));
  writeJson(cfgPath, cfg);
  console.log(`Package manager: ${arg}\n${cfg.verify.map((s) => `  ${s.name}: ${s.run}`).join("\n")}`);
  process.exit(0);
}

if (cmd === "axe") {
  const p = path.join(root, "tests", "e2e", "routes.json");
  const r = JSON.parse(fs.readFileSync(p, "utf8"));
  r.axe = arg === "on";
  fs.writeFileSync(p, JSON.stringify(r, null, 2) + "\n");
  console.log(`Accessibility check (axe) in all-buttons.spec.ts: ${r.axe ? "ON (needs: npm i -D @axe-core/playwright)" : "OFF"}`);
  process.exit(0);
}

fail(`unknown command: ${cmd}. Use: detect | db <name> | pm <name> | axe <on|off>`);
