---
paths:
  - "supabase/**"
  - "drizzle/**"
  - "drizzle.config.*"
  - "prisma/**"
  - "{src/,}{db,lib/db,server/db}/**"
  - "firestore.rules"
  - "firestore.indexes.json"
  - "firebase.json"
  - "scripts/seed*"
  - "scripts/db/**"
---

# Database: general rules (apply to every provider)

Provider-specific rules for the active database live in `.claude/rules/database.md`, installed by `/kit-setup` from `.claude/library/database/`. Read that file first.

## Schema design
- Every new table/collection, column, type, nullability, default, relation, index, and delete behavior (cascade/restrict) must be approved by the user (recorded in the scope card; an ADR when it is hard to reverse). Never guess column names or types.
- Naming: plural `snake_case` tables (`order_items`), `snake_case` columns, primary key `id`, foreign keys `<singular>_id`.
- Every table has `created_at` and `updated_at`. Soft delete (`deleted_at`) only when asked for.
- Money is stored as an integer in the smallest unit (e.g. rupiah without decimals) or as `decimal`, **never as float**.
- Times are stored in UTC. Conversion to the local time zone happens in the UI.
- Index columns used in WHERE/JOIN/ORDER BY, and every foreign key.
- Constraints live in the database (NOT NULL, UNIQUE, FK, CHECK), not only in application validation.

## Migrations
- One schema change = one NEW migration. Existing migrations **must not be edited** (a hook blocks it).
- A migration must run on an empty database and on one that already has data. A new NOT NULL column on a table with data needs a default or a backfill step.
- Data-destroying changes (drop column/table, change type) must be asked to the user, with a rollback plan written in the scope card.
- Migrations run only on the **local/dev** database. For staging/production, the user runs them.

## Seeders
- Seeders are idempotent: safe to run repeatedly (upsert or check first, no duplicates).
- Separate **reference** seeds (roles, categories, required data) from **dummy** seeds (sample data for dev/test).
- Dummy data is realistic but fake (sample names, `@example.com` emails). Never real personal data.
- E2E test accounts are created by a seeder, with credentials documented in `tests/e2e/README.md` (not in the real `.env`).
- Every new seeder is noted in `docs/database.md`: how to run it and which data it creates.

## Documentation
- Update `docs/database.md` on every schema change: table list, important columns, relations, and how to reset the local DB.
