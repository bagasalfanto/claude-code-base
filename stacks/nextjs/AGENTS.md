# AGENTS.md

Project facts for every AI coding agent (Claude Code reads this file through `@AGENTS.md` in CLAUDE.md).
Short and factual. Filled in by `/kit-setup`; how we work lives in `.claude/rules/00-core-rules.md`. Anything marked `NOT FILLED` is not verified yet.

## App
- Name: NOT FILLED
- Description: NOT FILLED
- UI copy language: NOT FILLED

## Stack
- Framework: Next.js (App Router), version NOT FILLED
- Language: TypeScript (strict)
- Styling/UI: NOT FILLED
- Database: NOT FILLED (detailed rules: `.claude/rules/database.md`)
- ORM / DB client: NOT FILLED
- Auth: NOT FILLED
- Package manager: NOT FILLED

## Commands (from the project root)
- Install: NOT FILLED
- Dev server: NOT FILLED
- Lint: NOT FILLED
- Typecheck: `npx tsc --noEmit`
- Unit tests: NOT FILLED
- E2E: `npx playwright test`
- Local migration: NOT FILLED
- Local seed: NOT FILLED
- All checks at once: `node .claude/scripts/verify.mjs`

## Folder layout
- `app/` or `src/app/`: routes (NOT FILLED: pick the right one)
- `components/`: UI components · `components/ui/`: shared base components
- `lib/`: server code & utilities · `lib/db/`: database access
- `.scratch/<feature>/`: Matt's flow: `spec.md`, `issues/NN-*.md` (tickets), `scope/NN-*.md` (kit scope cards). Committed.
- `GLOSSARY.md`: domain language (written by `/grill-with-docs`) · `docs/adr/`: decisions that are hard to reverse
- `docs/agents/`: issue tracker + triage labels + domain docs config (written by `/setup-matt-pocock-skills`)
- `CODING_STANDARDS.md`: judgement rules used by `/code-review` · `docs/database.md`: database structure
- `tests/e2e/`: Playwright (`all-buttons.spec.ts` + `routes.json`)

## Conventions
- Components `PascalCase.tsx`, utilities `camelCase.ts`, route folders `kebab-case`.
- Server Components by default. Validate input on the server with Zod.
- Public env vars only with the `NEXT_PUBLIC_` prefix. Every new env var is listed in `.env.example`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:` ...).

## Never
- Read, write, or print `.env*` (except `.env.example`).
- Edit existing migrations, lockfiles, or generated files.
- Run migrations/seeds/deploys against any non-local database or server.
- Change files outside the approved scope card (`.scratch/**/scope/*.md`).
