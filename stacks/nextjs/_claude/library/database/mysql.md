---
paths:
  - "drizzle/**"
  - "drizzle.config.*"
  - "prisma/**"
  - "{src/,}{db,lib/db,server/db}/**"
  - "scripts/seed*"
---

# Active database: MySQL / MariaDB + Next.js

ORM: use whatever the project already has. If there is none, **ask the user**: Drizzle (recommended, lightweight and type-safe) or Prisma.

## Structure (Drizzle)
- Schema: `{src/,}db/schema/*.ts` (one file per domain), exported through `db/schema/index.ts`.
- Connection: `{src/,}db/index.ts` using `mysql2` with a **connection pool**, starting with `import "server-only"`.
- Migrations: `npx drizzle-kit generate` → SQL files in `drizzle/`. Review the SQL before running it. Apply with `npx drizzle-kit migrate` (local only).
- Seeders: `{src/,}db/seed/*.ts`, run via an `npm run db:seed` script.

## Structure (Prisma)
- Schema `prisma/schema.prisma`, migrations `npx prisma migrate dev --name <name>` (local), seed via `prisma.seed` in package.json.

## Must
- InnoDB engine, `utf8mb4` charset and `utf8mb4_unicode_ci` collation (or `utf8mb4_0900_ai_ci` on MySQL 8).
- Primary key: `bigint unsigned auto_increment` or UUID/ULID (per the user's decision, consistent across tables).
- Foreign keys with an explicit `on delete` action, plus their index.
- `varchar` with sensible lengths (email 255, name 100) and `text` for long content.
- Boolean: `boolean`/`tinyint(1)`. Enum: a reference table or `enum` (ask the user which).
- Time: `datetime`/`timestamp` in UTC. Make sure the connection time zone is `+00:00`.
- Transactions for multi-table operations.
- Avoid N+1: load relations with a join/`with`, never query inside a loop.

## Never
- `drizzle-kit push`/`prisma db push` to a shared database, or `prisma migrate reset` without permission.
- Editing a generated migration file. Create a new migration.
- Raw queries with strings from user input (use placeholders/the `sql` template).
