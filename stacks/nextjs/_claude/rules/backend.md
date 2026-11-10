---
paths:
  - "{src/,}app/**/route.{ts,js}"
  - "{src/,}app/**/actions.{ts,js}"
  - "{src/,}app/**/*.server.{ts,js}"
  - "{src/,}{lib,server,services,actions}/**"
  - "{src/,}{middleware,proxy}.{ts,js}"
---

# Backend: Next.js (Route Handlers, Server Actions, server code)

## Must
- **Validate every input on the server** with a schema (Zod or whatever the project already uses): body, params, query, form data. Reject with a clear message (400/422).
- **Check authentication AND authorization in every** server action and route handler, not only in middleware/proxy. Server actions can be called directly from outside the UI, so make sure users can only reach their own data.
- Files that use secrets or the database start with `import "server-only"` so they never leak into the client bundle.
- Consistent API responses: `{ data }` on success, `{ error: { code, message } }` on failure, with correct HTTP status codes (200/201/400/401/403/404/409/422/500).
- Errors never show stack traces or database details to the user. Log the details on the server.
- Database queries go through one layer (`lib/db/**` or the existing repository/service), not scattered across components.
- After a mutation, refresh the relevant cache (`revalidatePath`/`revalidateTag`/`refresh`, depending on the project's Next version).
- Operations that change many rows at once use a transaction.
- File uploads: limit type and size, store in storage (not in the repo), and never trust the user's file name.
- Rate limit login, register, password reset, and expensive public endpoints (ask the user what to use if nothing exists yet).

## Never
- Build SQL by concatenating user input. Use a query builder/ORM or parameters.
- Return whole database rows to the client. Select only the fields needed (never leak password hashes or tokens).
- Store passwords without hashing (use an auth provider or bcrypt/argon2).
- Add a new env var without also adding it to `.env.example` (empty value) and telling the user.
- Call third-party APIs that need a secret from the client.

## Backend tests
- Non-UI business logic gets unit/integration tests (`*.test.ts`). Minimum cases: success, invalid input, not logged in, not the owner.
