# claude-code-base

A base kit for Claude Code projects (Next.js or Laravel) that sits **around** [Matt Pocock's skills](https://github.com/mattpocock/skills):

- **Matt's skills = the process**: grill the idea, write the spec, split it into tickets, TDD, code review, retro.
- **This kit = the guard rails**: hooks that make the agent stay in scope, ask before deciding, test 1–3 rounds, never touch secrets or existing migrations, and never commit untested code.

Matt's skills are **not bundled**. They are installed per project from skills.sh, so you always get his latest version.

```
Layer 1  Process      Matt's skills        /grill-with-docs → /to-spec → /to-tickets → /implement (tdd + code-review)
Layer 2  Bridge       kit skills           scope-lock · ui-verify · db-change · retro-apply · kit-setup
Layer 3  Enforcement  kit hooks            scope gate · bash guard · commit gate · stop/UI gate · prompt commands
Layer 4  Knowledge    project files        AGENTS.md · GLOSSARY.md · docs/adr · CODING_STANDARDS.md · .claude/rules
```

---

## Quick start (new project)

Requirements: Node 18+, git, and Claude Code. Works on Windows, macOS and Linux. On Windows, install [Git for Windows](https://git-scm.com/download/win) (Claude Code runs hooks through Git Bash when it's available).

```bash
# 1. Create the app first
npx create-next-app@latest my-app && cd my-app
git init

# 2. Install the kit (stack is auto-detected; --stack nextjs|laravel to force)
npx -y github:bagasalfanto/claude-code-base init --with-skills

# 3. In Claude Code
claude
/setup-matt-pocock-skills
/kit-setup

# 4. Commit the setup
git add -A && git commit -m "chore: add claude-code-base kit"
```

Without `--with-skills`, install the skills later with `node .claude/scripts/skills.mjs install`. That runs the skills.sh CLI for every source in `.claude/kit-skills.json`, for example:

```bash
npx -y skills@latest add mattpocock/skills --skill grill-with-docs --skill to-spec ... -a claude-code --copy -y
```

Optional: a Playwright MCP server for the `ui-tester` agent's manual exploration (the kit works without it, using `playwright-cli` and `npx playwright test`):

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest              # macOS / Linux
claude mcp add playwright -- cmd /c npx -y @playwright/mcp@latest       # Windows
```

Use **either** skills.sh **or** Matt's Claude Code plugin, not both. Using both installs every skill twice.

Prefer not to use npx? Clone this repo once and run it from disk:

```bash
node ../claude-code-base/bin/init.mjs init --target .
node ../claude-code-base/bin/init.mjs doctor --target .
```

## Daily flow

| Lane | You type | What happens |
|---|---|---|
| **Feature** | `/grill-with-docs <idea>` | Claude interviews you, writes `GLOSSARY.md` and ADRs |
| | `/to-spec` → `/to-tickets` | `.scratch/<feature>/spec.md` + `issues/01-*.md …` (vertical slices, no file paths) |
| | `/scope-lock 01` | Claude reads the ticket and the code, asks what's still undecided, writes `.scratch/<feature>/scope/01-*.md` with the exact files, then proposes it |
| | `APPROVE` | Only now can code be edited, and only the files on the card |
| | `/implement 01` | TDD at the agreed seams → `/code-review` → commit. The commit only goes through after `verify.mjs` passes |
| | (automatic) | Stop gate: verify must pass (max 3 failing rounds). UI changed → `ui-verify` (browser tests + all buttons) |
| | `/clear` | Fresh context for the next ticket |
| **Quick** | `/scope-lock fix the footer typo` | Quick card in `.scratch/quick/` → `APPROVE` → change → verify |
| **Bug** | `/diagnosing-bugs …` | Investigates read-only, then `/scope-lock` a `fix-` card, failing test first |
| **Learn** | `/retro` → `/retro-apply` | Mistakes become checks (hooks, lint, CI) or a line in `CODING_STANDARDS.md` |

### Commands only you can type (in the chat)

| Command | Effect |
|---|---|
| `APPROVE` | Approve the proposed scope card |
| `CANCEL` | Drop the active scope |
| `ADD SCOPE src/lib/x.ts` | Add a file/glob to the active scope |
| `GATE OFF` / `GATE ON` | Turn the scope gate off/on (safety rules stay on) |

The agent cannot run these through the shell: the bash guard blocks `scope.mjs approve|off|on|scope-add|reset` and any write to `.claude/state/`.

## What is enforced (and by what)

| Rule | Enforced by |
|---|---|
| No code edits before an approved scope card | `scope-guard.mjs` (PreToolUse) |
| Edits outside the card ask you first, or are **denied** in bypass mode | `scope-guard.mjs` + `strictInBypass` |
| Never read/write `.env*`, lockfiles, generated files, kit state | `scope-guard.mjs`, `bash-guard.mjs`, settings deny rules |
| Existing migrations can't be edited; a new one must be created | `scope-guard.mjs` |
| No `test.skip`/`.only`/`markTestSkipped` added; suppressions ask | `scope-guard.mjs` |
| Testers (`ui-tester`, `button-tester`) can only write `tests/e2e/**` | `scope-guard.mjs` (`agentPaths`) |
| No force push, `reset --hard`, `--no-verify`, DB wipes, remote resets, publish | `bash-guard.mjs` (deny) |
| Installs, migrations, seeds, deploys, `git push` ask first | `bash-guard.mjs` (ask) + settings |
| No `git commit` of code changed after the last passing verify | `bash-guard.mjs` (commit gate) |
| Turn can't end with untested code; max 3 failing rounds, then stop and report | `stop-gate.mjs` |
| UI changed → a browser test must pass | `stop-gate.mjs` (UI gate) + `verify.mjs` |
| Quick checks before every commit, full checks in CI | `.githooks/pre-commit`, `.github/workflows/verify.yml` |

### Bypass mode (`--dangerously-skip-permissions`)

All hooks still run in bypass mode. Rules that normally *ask* you (out-of-scope edits, installs, `git push`, DB resets) are **denied** instead, so nothing risky happens while you're away. Set `"strictInBypass": false` in `.claude/kit.config.json` to let them through.

## What gets installed

```
CLAUDE.md                  @AGENTS.md + pointers (Matt's setup appends "## Agent skills")
AGENTS.md                  project facts, filled by /kit-setup
CODING_STANDARDS.md        judgement rules for /code-review (base + stack section)
CLAUDE.local.md.example    personal notes template (CLAUDE.local.md is gitignored)
docs/database.md           schema overview, kept current by the db-change skill
playwright.config.ts       stack-specific (dev server, baseURL)
tests/e2e/                 all-buttons.spec.ts + routes.json (+ optional axe check)
.githooks/pre-commit       verify --quick
.github/workflows/verify.yml
.claude/
  settings.json            permissions + hook wiring
  kit.config.json          protected files, scope rules, verify steps, DB commands
  kit-skills.json          which third-party skills to install
  rules/                   00-core-rules.md + frontend/backend/database-general/testing (path-scoped)
  library/database/        supabase · mysql · turso · firebase (one becomes rules/database.md)
  skills/                  kit skills (+ Matt's and extras after install)
  agents/                  ui-tester · button-tester
  hooks/                   the enforcement layer (+ test/ suite)
  scripts/                 scope · verify · db · setup · skills
  state/                   runtime state (gitignored)
```

`.scratch/` (specs, tickets, scope cards) is **committed**. It is your project's decision history.

## Adding your own skills

- Put a folder with a `SKILL.md` in `.claude/skills/<name>/`. Claude Code discovers it automatically; a clear `description` decides when it is used.
- To install from skills.sh in every project, add the source to `.claude/kit-skills.json` (or to `template/_claude/kit-skills.json` in this repo for all future projects), then run `node .claude/scripts/skills.mjs install`.
- Update installed skills with `npx skills@latest update`.

## Customizing per project

Everything lives in `.claude/kit.config.json`:

- `protected`: globs nobody may edit (supports `!negation`)
- `alwaysEditable`: docs the agent may write without a scope card
- `verify`: the check steps (`when: "script:lint"`, `"file:tsconfig.json"`, `full: true` for slow steps)
- `maxTestRounds`, `requireUiTests`, `uiGlobs`, `migrationGlobs`
- `bashGuard.deny` / `bashGuard.ask`: extra `{ "pattern": "regex", "reason": "..." }` rules
- `enforce: false` turns the scope gate off for good (safety rules stay)

## Updating a project to a newer kit

```bash
npx -y github:bagasalfanto/claude-code-base init --update
```

Kit-owned files (hooks, scripts, kit skills, tester agents, database library, all-buttons test) are refreshed. Files you own (rules, AGENTS.md, CLAUDE.md, CODING_STANDARDS.md, configs) are kept. JSON configs are merged: your values win, and new kit entries are added. If a file you edited has a newer kit version, it is written next to yours as `*.kit-new` for you to compare.

## Publishing your own copy

`npx github:<user>/claude-code-base` only works for other people if the repository is **public** (a private repo works for you if git on your machine is signed in to GitHub). Before the first commit from Windows, mark the two scripts as executable so macOS/Linux users get working files:

```bash
git add -A
git update-index --chmod=+x bin/init.mjs template/_githooks/pre-commit
git commit -m "feat: claude-code-base kit"
```

## Developing this repo

```bash
npm test            # hook test suite (15 tests)
npm run smoke       # installs into temp Next.js + Laravel projects and checks everything
```

Layout: `template/` is shared by every stack, and `stacks/<name>/` is the overlay. Dot-folders are stored as `_claude`, `_github` and `_githooks`, and the installer renames them. Add a stack by copying `stacks/nextjs` and editing its `kit.config.json`, rules, `AGENTS.md` and `playwright.config.ts`.

## Honest limits

- Hooks guard the **tools** (Edit, Write, Bash, PowerShell). Code written through another route, such as an MCP server that writes files, is not checked.
- Pattern rules for the bash guard catch the common forms of risky commands, not every possible spelling. They are a seatbelt, not a sandbox. Real isolation needs a container or a separate OS user.
- The UI gate needs Playwright installed. Until then, the e2e step reports SKIPPED and the stop hook keeps reminding you.
- `implement-spec` (Matt's parallel worktree implementer) is not wired into the scope gate in this version. Use `/implement` per ticket.
- Matt's skills change often. If a skill is renamed, update `.claude/kit-skills.json`; `skills.mjs list` shows what's missing.

## License

MIT
