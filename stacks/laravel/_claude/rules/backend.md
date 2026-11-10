---
paths:
  - "app/Http/**"
  - "app/Actions/**"
  - "app/Services/**"
  - "app/Policies/**"
  - "app/Jobs/**"
  - "app/Events/**"
  - "app/Listeners/**"
  - "app/Rules/**"
  - "routes/**"
  - "config/**"
---

# Backend: Laravel

Check the Laravel version in `composer.json` and follow the structure the project uses (e.g. `bootstrap/app.php` for middleware in Laravel 11+).

## Must
- **Validate through Form Requests** (`php artisan make:request`) for every input. Controllers only use `$request->validated()`, never `$request->all()`.
- **Authorize through Policies/Gates** (`$this->authorize()`, `Gate::authorize()`, or `can:` middleware) in every action touching user-owned data. Routes that need login are protected by `auth` middleware (and `verified` when needed).
- Safe mass assignment: explicit `$fillable` on models. Never `$guarded = []`.
- Thin controllers. Business logic in Action/Service classes (follow the existing pattern).
- Multi-table operations inside `DB::transaction()`.
- Avoid N+1: eager loading (`with()`), and enable `Model::preventLazyLoading()` outside production if it isn't already (ask the user first).
- APIs (if any): API Resources for response shapes, correct HTTP statuses, consistent JSON errors.
- Named routes (`->name('...')`) grouped by shared middleware.
- Rate limit login, register, password reset, and public endpoints (`throttle:`).
- Slow work (email, exports, third-party API calls) → Jobs/queues. Ask the user whether queues are already in use.
- Uploads: validate `mimes`/`max`, store with `Storage` (private disk by default), never trust the original file name.

## Never
- `DB::raw`/`whereRaw` with user input and no bindings.
- `env()` outside `config/`. Use `config()`.
- Showing exceptions/stack traces to users. Disabling CSRF.
- Adding composer packages without the user's permission (the hook asks).

## Backend tests
- Feature tests (Pest/PHPUnit, follow what exists) for every route/action: success, validation failure, not logged in (redirect/401), not the owner (403). Use `RefreshDatabase` and factories.
