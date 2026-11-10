---
name: retro-apply
description: Turn the findings of Matt's /retro into lasting fixes in this project - mechanical problems become deterministic checks (kit.config bashGuard/protected rules, lint rules, verify steps, CI), judgement problems become lines in CODING_STANDARDS.md or the rules files. Use after /retro, or when the user says "make sure this never happens again".
disable-model-invocation: true
argument-hint: "[path to retro notes, or paste them]"
---

# retro-apply

Matt's `/retro` sorts what went wrong into **mechanical** (a machine could catch it every time) and **judgement** (needs taste). This skill installs the fix in the right place. Prefer a check over a sentence: rules in prose get ignored under pressure; hooks and linters don't.

## 1. Collect

Read the retro output (argument, the conversation, or ask the user to paste it). List each finding as one line: what happened, which kind.

## 2. Choose where each fix goes

| Finding | Fix lives in | Example |
|---|---|---|
| A dangerous command ran / almost ran | `.claude/kit.config.json` → `bashGuard.deny` or `bashGuard.ask` (`{ "pattern": "regex", "reason": "..." }`) | `prisma migrate reset` against prod |
| A file was edited that never should be | `.claude/kit.config.json` → `protected` (glob) | generated API client |
| A code pattern slipped in | lint rule (eslint / phpstan / pint config) or a new `verify` step | `console.log` left in server code |
| A check was skipped before commit | `verify` step with `"full": true`, CI workflow, or `.githooks/pre-commit` | e2e never ran in CI |
| Agent misunderstood the domain | `GLOSSARY.md` (term) or `docs/adr/` (decision) | "order" vs "cart" |
| Code smell / design judgement | `CODING_STANDARDS.md` (one line, with a why) | "No business logic in route handlers" |
| Area-specific habit | the matching `.claude/rules/*.md` | form validation pattern |
| Process slip (scope, questions, testing) | `.claude/rules/00-core-rules.md` only if no check can catch it | |

Write rules with the `writing-for-agents` skill: short, concrete, one reason each, no shouting.

## 3. Lock the scope and apply

These are code/config changes, so they go through the normal gate: write `.scratch/quick/retro-<date>.md` with the `scope-lock` card format (scope = the exact config/rule files), propose it, wait for **APPROVE**. Then apply.

`.claude/settings.json` and hook scripts are part of the kit itself; change them only if the user explicitly asks, and say what the change does.

## 4. Prove it

For every mechanical fix, show it working: run the hook test suite (`node --test .claude/hooks/test/hooks.test.mjs`), run the new lint rule against an example, or run `node .claude/scripts/verify.mjs`. A check that was never seen failing is not a check.

## Report

Table: finding → kind → where the fix lives → how it was proven. Plus anything you recommend but did not do.
