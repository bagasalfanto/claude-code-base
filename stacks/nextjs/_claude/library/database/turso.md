---
paths:
  - "drizzle/**"
  - "drizzle.config.*"
  - "{src/,}{db,lib/db,server/db}/**"
  - "scripts/seed*"
  - "*.db"
---

# Active database: Turso (libSQL / SQLite) + Next.js

Recommended stack: Drizzle ORM + `@libsql/client`. If the project uses something else, follow what exists.

## Structure
- Schema: `{src/,}db/schema/*.ts` (drizzle `sqlite-core`). Connection: `{src/,}db/index.ts` with `createClient({ url, authToken })` from server env (`import "server-only"`).
- Local dev: URL `file:local.db` or a local libSQL server (`turso dev`), **not** the Turso cloud database.
- Migrations: `npx drizzle-kit generate` → `drizzle/`, apply locally with `npx drizzle-kit migrate`. Check the dialect in `drizzle.config.ts` (`turso` or `sqlite`).
- Seeders: `{src/,}db/seed/*.ts` via `npm run db:seed`.

## SQLite limits to keep in mind
- `ALTER TABLE` is limited. Changing a column's type or constraints means recreating the table (drizzle-kit generates the SQL). Review that migration carefully because data is copied.
- Loose typing: enforce types through the Drizzle schema and Zod validation. Use `CHECK` constraints for important values.
- Store dates as integers (unix ms, `mode: "timestamp_ms"`) or ISO-8601 text. Pick one and stay consistent.
- Boolean = integer 0/1 (`mode: "boolean"`). Money = integer in the smallest unit.
- Foreign keys must actually be enforced. Confirm with the driver/Turso docs and test cascades.
- One writer at a time: avoid long write transactions. Split big batch inserts.

## Never
- Running migrations or seeds against the Turso cloud database (production/staging) without the user's permission.
- `turso db destroy`/`delete` (blocked by a hook). `drizzle-kit push` to a shared DB.
- Putting `TURSO_AUTH_TOKEN` on the client or in `NEXT_PUBLIC_*`.
- Committing local `*.db` files (make sure they are in `.gitignore`).
