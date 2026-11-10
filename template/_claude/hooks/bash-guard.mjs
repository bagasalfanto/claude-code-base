// PreToolUse (Bash | PowerShell) — blocks destructive, secret-leaking and gate-bypassing commands.
// Permission rules in settings.json are the first line; this hook catches what prefix rules miss
// (flags in any position, PowerShell spellings, chained commands). Extra rules: kit.config.json -> bashGuard.
import { runHook, loadConfig, loadEdits, loadVerify, preToolDecision, strictBypass } from "./lib.mjs";

const DENY = [
  [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\s+(\/|~|\$HOME|[a-z]:[\\/]?)(\s|$)/i, "recursive delete of root/home"],
  [/Remove-Item\b.*-Recurse\b.*\s([a-z]:\\?|~|\$HOME|\$env:USERPROFILE)(\s|$)/i, "recursive delete of drive/home"],
  [/\bformat\s+[a-z]:/i, "disk format"],
  [/\bgit\s+push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/i, "git push --force"],
  [/\bgit\s+reset\s+--hard\b/i, "git reset --hard"],
  [/\bgit\s+clean\s+-[a-z]*f/i, "git clean -f"],
  [/\bgit\s+(commit|push|merge)\b.*--no-verify\b/i, "--no-verify (skips git hooks)"],
  [/\bgit\s+checkout\s+(--\s+)?\.(\s|$)|\bgit\s+restore\s+(--\S+\s+)*\.(\s|$)/i, "discarding all changes"],
  [/\b(cat|type|more|less|head|tail|Get-Content|gc|bat)\b[^|;&]*\.env(?!\.example)(\.[\w-]+)?(\s|$|["'])/i, "reading a .env file"],
  [/(^|[\s;&|])(printenv|env)(\s*$|\s*[;&|])|Get-ChildItem\s+env:|\bgci\s+env:|\bdir\s+env:|\$env:\w*(KEY|SECRET|TOKEN|PASSWORD)/i, "printing environment variables"],
  [/\bscope\.mjs\s+(approve|off|on|scope-add|reset)\b/i, "approving/changing the scope gate (user only)"],
  [/\.claude[\\/]state\b[^|;&]*(>|Set-Content|Out-File|Add-Content|\bcp\b|\bmv\b|Copy-Item|Move-Item|Remove-Item|\brm\b)|(>|Set-Content|Out-File|Add-Content)[^|;&]*\.claude[\\/]state/i, "modifying kit state"],
  [/\bnpm\s+publish\b|\bpnpm\s+publish\b|\byarn\s+publish\b/i, "publishing a package"],
  [/\bfirebase\s+firestore:delete\b/i, "deleting Firestore data"],
  [/\bturso\s+db\s+(destroy|delete)\b/i, "deleting a Turso database"],
  [/\bDROP\s+(DATABASE|SCHEMA)\b/i, "DROP DATABASE/SCHEMA"],
  [/\bsupabase\s+db\s+reset\b.*--linked\b/i, "resetting a remote Supabase database"],
];

const ASK = [
  [/\bgit\s+push\b/i, "git push"],
  [/\bgit\s+(rebase|commit\s+--amend)\b/i, "rewriting git history"],
  [/\b(npm|pnpm|yarn|bun)\s+(i|install|add|remove|uninstall|rm|update|upgrade)\b(?!\s*$)/i, "adding/removing dependencies"],
  [/\bcomposer\s+(require|remove|update)\b/i, "adding/removing composer dependencies"],
  [/\bphp\s+artisan\s+(migrate:(fresh|reset|refresh|rollback)|db:wipe)\b/i, "database reset/rollback"],
  [/\bphp\s+artisan\s+migrate\b.*--force\b/i, "migrate --force"],
  [/\bprisma\s+(migrate\s+reset|db\s+push)\b/i, "prisma reset/db push"],
  [/\bdrizzle-kit\s+(push|drop)\b/i, "drizzle-kit push/drop"],
  [/\bsupabase\s+(db\s+(reset|push)|migration\s+repair)\b/i, "changing the Supabase database"],
  [/\bfirebase\s+deploy\b/i, "firebase deploy"],
  [/\bturso\s+db\s+(create|shell)\b/i, "Turso database command"],
  [/\b(vercel|netlify)\b.*(--prod|deploy)\b/i, "deploy"],
  [/\bTRUNCATE\b|\bDROP\s+TABLE\b|\bDELETE\s+FROM\b/i, "query that deletes data"],
  [/\bcurl\b.*\|\s*(ba)?sh|\biwr\b.*\|\s*iex|Invoke-Expression/i, "running a script from the internet"],
  [/\bdb\.mjs\s+(reset|seed)\b/i, "resetting/seeding the local database"],
  [/\bgit\s+config\b/i, "changing git config"],
];

runHook(async (input, root) => {
  const cmd = String((input.tool_input && input.tool_input.command) || "");
  if (!cmd.trim()) return;
  const cfg = loadConfig(root);
  const extra = cfg.bashGuard || {};
  const extraDeny = (extra.deny || []).map((r) => [new RegExp(r.pattern, "i"), r.reason || r.pattern]);
  const extraAsk = (extra.ask || []).map((r) => [new RegExp(r.pattern, "i"), r.reason || r.pattern]);

  for (const [re, label] of [...DENY, ...extraDeny]) {
    if (re.test(cmd)) {
      return preToolDecision(
        "deny",
        `BASH GUARD: blocked (${label}). Do not try another way around it. Explain to the user what you wanted to do and let the user run it themselves if it is really needed.`,
      );
    }
  }
  // Commit gate: only verified code may be committed.
  if (/\bgit\s+commit\b/i.test(cmd) && cfg.enforce !== false) {
    const edits = loadEdits(root);
    const verify = loadVerify(root);
    if ((edits.lastCodeEditAt || 0) > (verify.lastPassAt || 0)) {
      return preToolDecision("deny", "COMMIT GATE: code changed after the last passing run. Run node .claude/scripts/verify.mjs until it PASSES, then commit.");
    }
  }

  const strict = strictBypass(input, cfg);
  for (const [re, label] of [...ASK, ...extraAsk]) {
    if (re.test(cmd)) {
      if (strict) return preToolDecision("deny", `BASH GUARD (bypass mode): ${label} needs the user's OK, so it is blocked here. Tell the user the exact command and why; they can run it themselves.`);
      return preToolDecision("ask", `BASH GUARD: ${label} needs user confirmation.`);
    }
  }
});
