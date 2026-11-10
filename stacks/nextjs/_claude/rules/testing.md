---
paths:
  - "tests/**"
  - "playwright.config.ts"
  - "**/*.{test,spec}.{ts,tsx}"
---

# Testing (unit + Playwright)

## Test layers
1. **Unit/integration** (`*.test.ts`, Vitest/Jest per project): server logic, validation, utilities.
2. **E2E flows** (`tests/e2e/<feature>.spec.ts`, written by the `ui-tester` agent): every acceptance criterion in the ticket/scope card becomes at least one test.
3. **All buttons** (`tests/e2e/all-buttons.spec.ts`, maintained by the `button-tester` agent): every new route is added to `tests/e2e/routes.json`.

## Must
- Playwright selectors based on role and text: `getByRole`, `getByLabel`, `getByText`. `data-testid` only when there is no other option. No brittle CSS selectors (`div > span:nth-child(3)`).
- No `waitForTimeout` to wait for results. Use auto-waiting assertions (`await expect(locator).toBeVisible()`).
- Every test is independent: it prepares its own data (seeder/fixture) and does not depend on test order.
- Login tests use accounts from the test seeder, never real accounts. Save login state in `tests/e2e/.auth/` (already gitignored).
- E2E runs against `localhost` via `webServer` in `playwright.config.ts`, never against production.
- Read the output of a failing test first (trace/screenshot in `test-results/`) before changing code.

## Never
- `test.skip`, `test.only`, `test.fixme`, deleting tests, or changing expectations to make them pass without the user's approval. A hook blocks this too.
- Mocking so much that the test no longer checks real behavior.

## Commands
- Everything: `node .claude/scripts/verify.mjs` · quick (no build/e2e): `--quick` · one step: `--only e2e`
- One e2e file: `npx playwright test tests/e2e/<file>.spec.ts` · report: `npx playwright show-report`
