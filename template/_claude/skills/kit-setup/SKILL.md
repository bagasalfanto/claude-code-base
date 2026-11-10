---
name: kit-setup
description: One-time project setup for this kit after init - detects the stack, asks the user what cannot be detected, activates the database rules, sets the package manager, fills AGENTS.md, and checks git, skills and Playwright. Run after /setup-matt-pocock-skills, and again whenever the stack or database changes.
disable-model-invocation: true
---

# kit-setup

Goal: after this, `AGENTS.md` has no `NOT FILLED`, `.claude/rules/database.md` exists, and the verify commands match the real project. Detect first; ask only what the files can't tell you; never guess.

## 1. Health check

```bash
node .claude/scripts/setup.mjs detect
node .claude/scripts/skills.mjs list
node .claude/scripts/scope.mjs status
git rev-parse --is-inside-work-tree
```

- Required skills missing → tell the user to run `node .claude/scripts/skills.mjs install` (it asks for permission) and restart Claude Code. Continue with the rest.
- `docs/agents/issue-tracker.md` missing → `/setup-matt-pocock-skills` hasn't run. Recommend the **local markdown** tracker (`.scratch/`), which this kit's scope cards build on. If the user picks GitHub/GitLab issues instead, note it in `AGENTS.md`: tickets live there and scope cards still go in `.scratch/<feature>/scope/`.
- Not a git repo → recommend `git init` (Matt's `/code-review` and `/implement` need git). The user runs it or approves it.

## 2. Ask (one numbered round, recommendations included)

Only what detect could not answer. Usually:

1. App name, one-line description, UI copy language(s).
2. Database provider: supabase | mysql | turso | firebase (recommend from detect output). Local dev setup (Docker / Supabase CLI / Turso dev / emulator / XAMPP etc.).
3. Auth approach.
4. Styling / UI library (Next.js) or frontend mode Blade / Livewire / Inertia + React|Vue (Laravel).
5. Package manager if no lockfile yet.
6. Accessibility check (axe) in the all-buttons test: on/off (recommend on for public apps; needs `@axe-core/playwright`).

## 3. Apply

```bash
node .claude/scripts/setup.mjs db <provider>     # copies the provider rules, sets db.mjs commands
node .claude/scripts/setup.mjs pm <npm|pnpm|yarn|bun>
node .claude/scripts/setup.mjs axe <on|off>
```

Then edit (all always-editable, no scope card needed):
- `AGENTS.md`: replace every `NOT FILLED` with verified facts (versions from `package.json`/`composer.json`, real script names). If something is unknown, leave `NOT FILLED` and say so.
- `docs/database.md`: provider + local reset/seed commands.
- `CODING_STANDARDS.md`: only if the user states a standard now.

If `package.json` lacks scripts the verify steps rely on (`lint`, `test`, `build`), tell the user which steps will be skipped until they exist; don't add tooling without asking.

## 4. Confirm

Run `node .claude/scripts/verify.mjs --quick` and show the result. Finish with a status card:

```
Stack: ... | DB: ... (rules active) | PM: ... | Git: yes/no
Matt skills: ok / missing: ...   Issue tracker: local .scratch / GitHub
Playwright: ready / not installed (command)   axe: on/off
Still NOT FILLED: ...
Next: /grill-with-docs <idea>  →  /to-spec  →  /to-tickets  →  /scope-lock 01
```
