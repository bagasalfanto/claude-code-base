---
name: scope-lock
description: Pin the exact files a piece of work may touch BEFORE any code is written. Turns one ticket from /to-tickets (or a small change / bug fix) into a scope card under .scratch/, asks the user every missing detail, proposes it, and waits for the user to type APPROVE. Use when starting a ticket, when the scope gate blocks an edit, or when the user says "lock scope", "start ticket NN", "small fix".
argument-hint: "[ticket path or number | short description of a small change]"
---

# scope-lock

Matt's specs and tickets deliberately contain **no file paths** (they rot). This kit needs paths so the hooks can stop scope creep. The scope card is where paths get pinned, at the last responsible moment: right before the work starts. The user approves them by typing `APPROVE`; nothing else unlocks code edits.

You do the fact-finding. The user makes the decisions. Never invent data, field names, UI copy, numbers, colors, or behaviour.

## 1. Pick the lane

| Situation | Card path | Source of truth |
|---|---|---|
| Ticket from `/to-tickets` | `.scratch/<feature>/scope/<NN>-<slug>.md` (same NN-slug as the ticket file) | `.scratch/<feature>/issues/<NN>-<slug>.md` + `spec.md` |
| Small change, no ticket (typo, copy, tweak, ≤ ~3 files) | `.scratch/quick/<slug>.md` | the user's message |
| Bug fix | `.scratch/quick/fix-<slug>.md` | the user's report + `/diagnosing-bugs` findings |
| Bigger than a ticket and no spec yet | **stop** — tell the user to run `/grill-with-docs` then `/to-spec` then `/to-tickets` first | |

If the argument is a number, find `.scratch/*/issues/<NN>-*.md`. If several features match, ask which one. Check `**Blocked by:**`: if a blocker ticket is not `Status: done`, tell the user and stop unless they say to continue.

## 2. Gather facts yourself (do not ask the user what the code can tell you)

1. `node .claude/scripts/scope.mjs status` — an active scope must be closed (`done`) or cancelled by the user (`CANCEL`) first.
2. Read the ticket, its spec, `GLOSSARY.md`, relevant `docs/adr/*`, `AGENTS.md`, and the rule files in `.claude/rules/` that match the area.
3. Explore the codebase: where similar things live, which files this work must create or change, existing components/helpers to reuse, existing tests.

## 3. Ask about everything that is still a decision

Ask in **numbered rounds of at most 5 questions**, each with your recommended answer and why, in the style of the `grilling` skill. Typical gaps:

- exact UI copy, labels, empty/error/loading states, validation messages
- field names, types, required/optional, limits, defaults
- who may do this (roles, ownership), what happens on failure
- data: new tables/columns? seed data? (→ the work will need the `db-change` skill)
- which test seams to use (Matt's `tdd` requires the user to agree on seams)
- anything the ticket leaves open, or where the code contradicts the spec

Use the user's terms from `GLOSSARY.md`. If they introduce a new domain term, add it to `GLOSSARY.md` (always editable). A decision that is hard to reverse and was a real trade-off goes into `docs/adr/` (offer, don't force).

Stop asking when every acceptance criterion is testable and the file list is concrete. Do not pad with questions you can answer by reading code.

## 4. Write the card

Use exactly these headings (the script checks them). Keep it short; the ticket stays the spec.

```markdown
# Scope: 03 password reset email

**Ticket:** .scratch/auth/issues/03-password-reset-email.md

## Goal
One or two sentences in domain language.

## Acceptance criteria
- Copied from the ticket, sharpened with the user's answers. Each one testable.

## Scope files
- `src/app/(auth)/reset/**`
- `src/lib/auth/reset-token.ts`
- `src/lib/auth/reset-token.test.ts`
- `supabase/migrations/*_password_resets.sql`
- `tests/e2e/password-reset.spec.ts`

## Test seams
- `createResetToken()` unit tests (agreed with the user)
- e2e: request reset → email link → new password → login

## Out of scope
- Rate limiting (ticket 05)
- Email template redesign

## Open questions
- none

## Answers from the user
- Token lifetime: 30 minutes.
- Error copy: "This link has expired. Request a new one."
```

Rules for `## Scope files`:
- Globs in backticks, as narrow as possible: a folder for a new route, single files for existing shared code.
- Include the test files you will write and any NEW migration/seeder path (existing migrations are always blocked).
- Never `**`, `src/**`, `app/**`, or `<placeholders>` — the script rejects them.
- Shared code (`components/ui/**`, layouts, config, `package.json`) only if the user agreed to it in this round.
- No ticket (quick lane)? Write `**Ticket:** none`.

`## Open questions` must be `- none` (or every item struck through `~~...~~` / ticked `[x]`) before proposing.

## 5. Propose and stop

```bash
node .claude/scripts/scope.mjs propose .scratch/auth/scope/03-password-reset-email.md
```

If it fails, fix the card (or ask the user) and run it again. When it succeeds, show the user a 5–10 line summary (goal, files, out of scope, seams) and end your turn with:

> Type **APPROVE** to start, or tell me what to change.

Do **not** start coding in the same turn. Do not run `scope.mjs approve` (blocked; only the user's `APPROVE` message counts).

## After APPROVE

- Ticket lane: work the ticket with `/implement` (or `/tdd` at the agreed seams). `/implement` reviews with `/code-review` and commits; the commit gate only lets the commit through after `node .claude/scripts/verify.mjs` passes.
- Quick lane: make the change, then run verify.
- UI changed → `ui-verify` skill. Schema/seed changed → `db-change` skill.
- A file outside the card turns out to be needed → stop and tell the user why; they can type `ADD SCOPE <glob>`. Do not route around it.
- Finished (verify PASS, UI verified) → `node .claude/scripts/scope.mjs done` (sets the ticket to `Status: done`), report, suggest `/clear` before the next ticket.
