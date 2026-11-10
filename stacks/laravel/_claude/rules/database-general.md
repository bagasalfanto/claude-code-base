---
paths:
  - "database/**"
  - "app/Models/**"
  - "config/database.php"
  - "supabase/**"
  - "firestore.rules"
  - "firestore.indexes.json"
---

# Database: general rules (Laravel, every provider)

Rules for the active provider live in `.claude/rules/database.md` (installed by `/kit-setup` from `.claude/library/database/`). Read that file first.

## Schema design
- New tables/columns, types, nullability, defaults, relations, indexes, and delete behavior (`cascadeOnDelete`/`restrictOnDelete`/`nullOnDelete`) must be approved by the user (recorded in the scope card; an ADR when it is hard to reverse). Never guess.
- Laravel conventions: plural `snake_case` tables, singular `PascalCase` models, FKs as `<model>_id` via `foreignId()->constrained()`.
- `$table->timestamps()` on every table. `softDeletes()` only when asked for.
- Money: `unsignedBigInteger` in the smallest unit or `decimal(15,2)`. Never `float`/`double`.
- Times stored in UTC (`config/app.php` timezone UTC), shown in the local time zone in views.
- Index frequently filtered/sorted columns, and unique constraints in the database, not only in validation.
- Enums: a PHP backed enum + `string` column, or a reference table (ask the user).
- Models: explicit `$fillable`, `casts()` for dates/booleans/enums/json, typed relations (`HasMany`, `BelongsTo`).

## Migrations
- One schema change = one NEW migration (`php artisan make:migration`). Existing migrations **must not be edited** (a hook blocks it).
- Fill in `down()` properly so rollback works.
- A new NOT NULL column on a table with data needs a default or a backfill step.
- Dropping/renaming columns or tables → ask the user and write a rollback plan in the scope card.
- `php artisan migrate` only for the local database. `migrate:fresh`/`reset`/`refresh`/`db:wipe` are always asked (hook).

## Seeders & factories
- Every new model gets a **Factory** with realistic but fake data (`fake()`, `@example.com` emails).
- Seeders are idempotent (`updateOrCreate`/`firstOrCreate`). Separate reference seeders (roles, categories) from dummy seeders.
- `DatabaseSeeder` calls seeders in order. E2E accounts are created in a dedicated seeder (e.g. `E2eUserSeeder`) and listed in `tests/e2e/README.md`.

## Documentation
- Update `docs/database.md` on every schema change: tables, key columns, relations, and how to reset + seed locally.
