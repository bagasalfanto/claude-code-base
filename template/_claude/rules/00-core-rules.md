# Core rules (always loaded)

This project uses Matt Pocock's skills for the process and this kit for enforcement. Hooks in `.claude/hooks/` enforce the hard limits below; when a hook blocks you, read its message, do what it says, and never look for a way around it.

## 1. Who decides

- **You find facts**: read the code, docs, `GLOSSARY.md`, `docs/adr/`, run read-only commands. Don't ask the user what the repo can tell you.
- **The user decides**: behaviour, UI copy, field names, data shapes, numbers, colors, limits, priorities, trade-offs, new dependencies, anything destructive.
- Never invent data, names, copy, or requirements. If something is unclear or the code contradicts the spec, ask. Numbered questions, each with your recommendation, at most 5 per round.
- Use the domain terms in `GLOSSARY.md`. Respect accepted ADRs; changing one is a user decision.

## 2. The flow

| Lane | When | Steps |
|---|---|---|
| **Feature** | new capability, more than one ticket | `/grill-with-docs` → `/to-spec` → `/to-tickets` → per ticket: `scope-lock` → user types **APPROVE** → `/implement` (or `/tdd`) → verify → `ui-verify` if UI → `scope.mjs done` → `/clear` |
| **Quick** | small, clear change (≤ ~3 files) | `scope-lock` (quick card) → **APPROVE** → change → verify → `scope.mjs done` |
| **Bug** | something is broken | `/diagnosing-bugs` (read-only investigation is fine without a scope) → `scope-lock` (`fix-` card) → **APPROVE** → failing test first → fix → verify → `done` |
| **Docs only** | `.scratch/`, `GLOSSARY.md`, `docs/adr/`, `docs/agents/`, `CODING_STANDARDS.md`, `AGENTS.md` | no scope needed |

One ticket per scope, one scope at a time. Specs and tickets stay path-free (Matt's rule); file paths live only in the scope card.

## 3. Scope

- Change only files matched by the approved card's `## Scope files`. Need another file? Stop and tell the user why; they can type `ADD SCOPE <glob>`.
- No drive-by refactors, renames, reformatting, dependency bumps, or "while I'm here" fixes. Note them in your report instead.
- An update to existing work changes only what the update is about.
- Commands only the user may type: `APPROVE`, `CANCEL`, `ADD SCOPE <glob>`, `GATE OFF`, `GATE ON`. Never ask the user to turn the gate off to get unblocked.

## 4. Testing: 1 to 3 rounds

- Every ticket ends with `node .claude/scripts/verify.mjs` passing. The stop hook enforces this; the commit gate blocks `git commit` of unverified code.
- UI changed → the `ui-verify` skill (browser tests for every acceptance criterion + all-buttons). The UI gate enforces this.
- A failing round → fix the cause inside the scope, run again. **Maximum 3 failing rounds.** After the third: stop, report what fails and what you tried, and ask the user.
- Never skip, `.only`, delete, or weaken a test to make it pass. If a test is wrong, ask first.

## 5. Safety (hard limits)

| Never | Instead |
|---|---|
| Read, write, or print `.env*` (except `.env.example`) or any secret | Ask the user which variable names exist; add new names to `.env.example` |
| Edit an existing migration, a lockfile, or a generated file | New migration (`db-change` skill); package manager / generator does the rest |
| Migrations, seeds, resets, or deploys against a non-local database or server | Local only via `node .claude/scripts/db.mjs`; give the user the remote command |
| `git push --force`, `reset --hard`, `clean -f`, `--no-verify`, rewriting pushed history | Explain and let the user decide |
| Install / remove / upgrade dependencies without asking | Ask, with the reason and the alternative |
| Visit external sites during browser tests | localhost / 127.0.0.1 only |

## 6. Reporting

End each ticket with: what changed (files), test results (command → result, round n/3), what was left out or noticed but not touched, and any decision the user still has to make. Be short. No claims you didn't verify.
