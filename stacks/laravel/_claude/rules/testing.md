---
paths:
  - "tests/**"
  - "phpunit.xml"
  - "playwright.config.ts"
---

# Testing: Laravel (Pest/PHPUnit + Playwright)

## Test layers
1. **Feature/Unit** (`tests/Feature`, `tests/Unit`, run with `php artisan test`): routes, validation, policies, business logic.
2. **E2E flows** (`tests/e2e/<feature>.spec.ts`, written by the `ui-tester` agent): every acceptance criterion becomes at least one browser test.
3. **All buttons** (`tests/e2e/all-buttons.spec.ts` + `routes.json`, maintained by the `button-tester` agent).

## Must
- Feature tests use `RefreshDatabase` + factories, and a separate test database (`phpunit.xml`/`.env.testing`, usually in-memory SQLite or a `_testing` DB). Never run tests against a dev database that holds important data.
- Minimum cases per action: success, validation failure, not logged in, not the owner/wrong role.
- E2E runs against a local `php artisan serve` through `webServer` in `playwright.config.ts`. The database used by e2e must be seeded with test accounts from a seeder (see `tests/e2e/README.md`).
- Playwright selectors: `getByRole`/`getByLabel`/`getByText`. Auto-waiting assertions, not `waitForTimeout`.
- Read the failure output (assertion message, `storage/logs/laravel.log`, Playwright trace in `test-results/`) before changing code.

## Never
- `->skip()`, `markTestSkipped`, `test.skip`/`.only`, deleting tests, or weakening assertions to pass. A hook blocks this.
- Tests that depend on order or leftover data from other tests.

## Commands
- Everything: `node .claude/scripts/verify.mjs` · quick: `--quick` · one step: `--only test`
- One PHP test: `php artisan test --filter=TestName` · one e2e file: `npx playwright test tests/e2e/<file>.spec.ts`
