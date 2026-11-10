---
paths:
  - "supabase/**"
  - "{src/,}{db,lib/db,lib/supabase,utils/supabase}/**"
  - "**/database.types.ts"
---

# Active database: Supabase (Postgres) + Next.js

## Structure
- Migrations: `supabase/migrations/<timestamp>_<name>.sql`, created with `npx supabase migration new <name>`. Plain Postgres SQL.
- Local seed: `supabase/seed.sql` (run automatically by `npx supabase db reset`). Large seeds may be split and listed in `supabase/config.toml`.
- Clients: use `@supabase/ssr`. Two helpers, a browser client and a server client, in `lib/supabase/` (follow the existing structure).
- Types: `npx supabase gen types typescript --local > {src/,}types/database.types.ts` after every migration. This file is generated; never edit it by hand.

## Must
- **RLS (Row Level Security) enabled on EVERY table in the `public` schema** (`alter table ... enable row level security;`) with explicit policies per action (select/insert/update/delete). A table without policies is unreachable, which is safer than open.
- Policies use `auth.uid()` for user-owned data, e.g. `using ((select auth.uid()) = user_id)`. Index the columns used in policies (`user_id`).
- The `service_role`/secret key **only on the server** (route handler/server action with `server-only`), never on the client or in `NEXT_PUBLIC_*`. The client uses the anon/publishable key.
- User profile data goes in a `public.profiles` table related to `auth.users(id)` with `on delete cascade` (unless the project already has another pattern). Never write directly to the `auth` schema.
- `security definer` functions must have `set search_path = ''` and are used only when necessary.
- Storage: buckets are private by default, with a policy per bucket.
- After a migration: `npx supabase db reset` (local), then generate types, then verify.

## Never
- `supabase db push`, `db reset --linked`, or changes to the remote project without the user's permission (the hook asks/blocks).
- Disabling RLS to make a query "work". Fix the policy.
- Editing an existing migration or `database.types.ts`.

## Quick agent checklist
- New table → `enable row level security` + policies? · FK column → indexed? · Types regenerated?
