---
name: db-change
description: Make a database schema or seed change safely for the active provider (Supabase, MySQL, Turso, Firebase) - always a NEW migration, idempotent seeders, access rules (RLS / Firestore rules / policies), local reset + seed, and docs/database.md updated. Use whenever work adds or changes tables, columns, indexes, relations, collections, security rules, or seed data.
---

# db-change

Database mistakes are the expensive kind. Every structural choice is the user's decision; your job is to find the facts, propose, and implement exactly what was approved.

## 0. Preconditions

- An approved scope card whose `## Scope files` include the new migration / seeder / rules paths. If not, stop: the user can type `ADD SCOPE <glob>` or you re-run `scope-lock`.
- Read `.claude/rules/database.md` (provider rules, installed by `/kit-setup`) and `.claude/rules/database-general.md`. If `database.md` is missing, ask the user which provider and stop (`node .claude/scripts/setup.mjs db <provider>` is part of `/kit-setup`).
- Read `docs/database.md`, existing migrations/models, and `GLOSSARY.md` (table and column names follow the glossary).

## 1. Propose the change, get answers

Write a short table for the user and ask for anything undecided:

| Table / collection | Column / field | Type | Null | Default | Index / unique | Relation + on delete |
|---|---|---|---|---|---|---|

Plus: who can read/write each row (RLS policy / Firestore rule / Laravel policy), what seed data is needed (realistic, never real personal data), and for anything destructive (drop, rename, type change, NOT NULL on existing data): a rollback / backfill plan. Record the answers in the scope card. A hard-to-reverse choice (e.g. soft delete vs hard delete, multi-tenant key) → offer an ADR in `docs/adr/`.

## 2. Implement

- **Always a new migration file**, generated with the provider's tool where it exists (the hook blocks edits to existing migrations):
  - Supabase: `npx supabase migration new <name>` → write SQL with RLS enabled + policies in the same migration.
  - Drizzle: change the schema file, then `npx drizzle-kit generate`. Prisma: `npx prisma migrate dev --create-only --name <name>`.
  - Laravel: `php artisan make:migration <name>`; implement `down()` too.
  - Firebase: no migrations — update `firestore.rules` + `firestore.indexes.json`, and a versioned data-migration script only if the user agreed.
- Seeders are **idempotent** (upsert / `firstOrCreate` / fixed IDs), run in a fixed order, and contain no secrets or real people.
- Regenerate types/clients when the provider requires it (e.g. `npx supabase gen types typescript --local`). Generated files are protected from hand edits; regenerating via the CLI is fine.

## 3. Apply locally only

```bash
node .claude/scripts/db.mjs status
node .claude/scripts/db.mjs reset    # asks the user first (hook)
node .claude/scripts/db.mjs seed     # asks the user first (hook)
```

Never target a remote/production database: no `--linked`, `migrate --force`, `db push` to a remote, deploys, or `turso db shell` on a prod DB. If the only database configured is remote, stop and tell the user.

## 4. Test and document

- Tests at the agreed seams: constraint/validation, access rules (owner can, other user cannot, anonymous cannot), seed runs twice without error.
- Update `docs/database.md`: table rows, relations, access rules summary, how to reset + seed.
- `node .claude/scripts/verify.mjs`.

## Report

New migration(s), access rules, seed data created, local reset result, tests, and anything the user must do on staging/production themselves (with the exact command, which you do not run).
