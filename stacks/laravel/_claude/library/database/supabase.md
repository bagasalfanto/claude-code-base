---
paths:
  - "database/**"
  - "app/Models/**"
  - "config/database.php"
  - "supabase/**"
---

# Active database: Supabase (Postgres) + Laravel

Here Supabase is used as the **Postgres database** for Laravel. Laravel migrations are the single source of truth for the schema.

## Structure
- `DB_CONNECTION=pgsql`, host/port from Supabase (use the connection pooler the Supabase dashboard recommends). Agents don't read `.env`; ask the user about connection problems.
- Migrations, models, factories, and seeders use the normal Laravel structure (`database/...`).
- Local dev: local Supabase (`npx supabase start`) or a dedicated dev Supabase project. **Never** the production project.

## Must
- Proper Postgres types: `jsonb()` for JSON, `timestampTz()` for times, `uuid()` for UUID PKs.
- **RLS**: Laravel connects as the table owner role, so RLS doesn't apply to it. But the `public` schema is also exposed by the Supabase API. So every new table **must** run `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` (in the migration via `DB::statement`), with no policies unless the user actually uses supabase-js/the API from the client. That way the table can't be read with the anon key.
- If the user uses Supabase Auth or Storage from the client, write explicit policies per action and test them.
- The service role/secret key only on the server (`config/services.php` from env), never sent to views/JS.

## Never
- `supabase db reset --linked`, `db push`, or migrations to the remote project without the user's permission.
- Creating tables through the dashboard/SQL editor without a Laravel migration (the schema drifts).
- Editing old migrations.
