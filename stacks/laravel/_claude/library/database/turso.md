---
paths:
  - "database/**"
  - "app/Models/**"
  - "config/database.php"
---

# Active database: Turso (libSQL / SQLite) + Laravel

**Heads-up:** Turso drivers for Laravel are still community packages or previews. Examples: `tursodatabase/turso-driver-laravel` (needs a native PHP extension) and `turso/libsql-laravel` (technical preview). Before installing any driver, **ask the user** which package to use, then check that package's README (Laravel version and Windows compatibility). Don't choose for them.

## Recommended way of working
- Local dev & tests: Laravel's built-in SQLite (`DB_CONNECTION=sqlite`, `database/database.sqlite`). The schema matches libSQL, so migrations are reusable.
- Connecting to Turso cloud is only for staging/production, configured by the user.

## SQLite limits to keep in mind
- `ALTER TABLE` is limited. Changing a column (`->change()`) makes Laravel copy the table. Review the migration and test it on a DB with data.
- Loose typing: enforce through Form Request validation and model `casts()`.
- Dates as UTC text/datetime. Boolean = 0/1. Money = integer in the smallest unit.
- Foreign keys: make sure `foreign_key_constraints` is enabled in `config/database.php` for the sqlite/libsql connection, then test cascades.
- One writer at a time: keep write transactions short and split big batch inserts.

## Never
- Migrations/seeds against the Turso cloud database without the user's permission. `turso db destroy/delete` (blocked by a hook).
- Committing local `*.sqlite`/`*.db` files with data.
- Putting the Turso token in views/JS.
