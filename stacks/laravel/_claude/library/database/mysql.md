---
paths:
  - "database/**"
  - "app/Models/**"
  - "config/database.php"
---

# Active database: MySQL / MariaDB + Laravel (Eloquent)

## Structure
- Migrations: `database/migrations/` (`php artisan make:migration create_<table>_table`).
- Models: `app/Models/`. Factories: `database/factories/`. Seeders: `database/seeders/`.
- Connection from `.env` (`DB_CONNECTION=mysql` or `mariadb`). Agents don't read `.env`. To learn the database name, ask the user or use `php artisan db:show` (output has no password).

## Must
- InnoDB engine, `utf8mb4` charset, `utf8mb4_unicode_ci` collation (Laravel default).
- PK `$table->id()` (bigint unsigned) or `ulid()`/`uuid()` per the user's decision, consistent across tables.
- FKs: `foreignId('user_id')->constrained()->cascadeOnDelete()` (delete action as agreed with the user). The FK index comes with it.
- `string()` with a clear length (default 255), `text()` for long content, `boolean()`, `decimal(15,2)` or `unsignedBigInteger` for money.
- Add indexes for frequently filtered/sorted columns (`$table->index([...])`) and `unique()` for unique data.
- Seeders run against the local DB: `php artisan db:seed --class=<Seeder>` (the hook asks for confirmation).
- After a migration: `php artisan migrate:status` as proof, then `node .claude/scripts/verify.mjs --quick`.

## Never
- `migrate:fresh`/`reset`/`refresh`/`db:wipe` without the user's permission, or `migrate --force` (production).
- Editing old migrations. Changing a column = a new migration with `->change()`.
- Raw queries with user input and no bindings.
