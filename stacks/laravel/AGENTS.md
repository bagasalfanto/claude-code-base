# AGENTS.md

Project facts for every AI coding agent (Claude Code reads this file through `@AGENTS.md` in CLAUDE.md).
Short and factual. Filled in by `/kit-setup`; how we work lives in `.claude/rules/00-core-rules.md`. Anything marked `NOT FILLED` is not verified yet.

## App
- Name: NOT FILLED
- Description: NOT FILLED
- UI copy language: NOT FILLED

## Stack
- Framework: Laravel, version NOT FILLED · PHP NOT FILLED
- Frontend mode: NOT FILLED (Blade / Livewire / Inertia + React/Vue)
- Styling: NOT FILLED
- Database: NOT FILLED (detailed rules: `.claude/rules/database.md`)
- Auth: NOT FILLED
- PHP tests: NOT FILLED (Pest/PHPUnit) · test database: NOT FILLED
- JS package manager: NOT FILLED

## Commands (from the project root)
- Install: `composer install` and NOT FILLED (npm/pnpm)
- Dev: `php artisan serve` + NOT FILLED (`npm run dev`)
- Format: `php vendor/bin/pint` · Analysis: NOT FILLED (larastan)
- PHP tests: `php artisan test`
- E2E: `npx playwright test`
- Local migration: `php artisan migrate` · Local seed: `php artisan db:seed`
- All checks at once: `node .claude/scripts/verify.mjs`

## Folder layout
- `app/Http/Controllers`, `app/Http/Requests` (validation), `app/Policies` (authorization), `app/Actions` or `app/Services` (business logic)
- `app/Models`, `database/migrations`, `database/factories`, `database/seeders`
- `resources/views` (Blade) · `resources/js` (Inertia/JS) · `routes/web.php`, `routes/api.php`
- `.scratch/<feature>/`: Matt's flow: `spec.md`, `issues/NN-*.md` (tickets), `scope/NN-*.md` (kit scope cards). Committed.
- `GLOSSARY.md`: domain language (written by `/grill-with-docs`) · `docs/adr/`: decisions that are hard to reverse
- `docs/agents/`: issue tracker + triage labels + domain docs config (written by `/setup-matt-pocock-skills`)
- `CODING_STANDARDS.md`: judgement rules used by `/code-review` · `docs/database.md`: database structure
- `tests/Feature`, `tests/Unit`, `tests/e2e` (Playwright: `all-buttons.spec.ts` + `routes.json`)

## Conventions
- PSR-12 via Pint. Thin controllers, validation in Form Requests, authorization in Policies.
- Named routes (`->name()`), models with explicit `$fillable`.
- Env vars are read only in `config/*.php`. Every new env var is listed in `.env.example`.
- Commits: Conventional Commits.

## Never
- Read, write, or print `.env*` (except `.env.example`).
- Edit existing migrations, `composer.lock`/lockfiles, or `vendor/`.
- `migrate:fresh`/`db:wipe`/migrations against a non-local database without the user's permission.
- Change files outside the approved scope card (`.scratch/**/scope/*.md`).
