---
name: ui-verify
description: Verify UI work in a real browser before a scope is closed. Runs the ui-tester agent (e2e tests for every acceptance criterion + manual exploration) and the button-tester agent (every button and link on touched routes), then the full verify. Use after changing pages, components, styles or views, or when the stop hook reports "UI GATE".
---

# ui-verify

The stop hook will not let a turn end while UI files changed after the last passing browser test. This skill is the way through. Tests prove the acceptance criteria; they are never weakened to pass.

## Steps

1. `node .claude/scripts/scope.mjs status` — note the card, ticket and the routes this work touches.
2. Check Playwright is installed: `npx playwright --version` and that `playwright.config.ts` exists. If missing, **stop** and give the user the commands (`npm i -D @playwright/test` and `npx playwright install chromium`; Laravel: same, in the project root). Do not install it yourself.
3. Make sure the dev server can start. `playwright.config.ts` starts it via `webServer`; if the app needs env vars or a seeded DB the user hasn't set up, report BLOCKED with what is needed.
4. Run both agents in parallel with short briefs (card path, ticket path, routes, what changed):
   - **ui-tester** → writes/updates `tests/e2e/<ticket-slug>.spec.ts`, one test per acceptance criterion, runs it, explores 375px and 1280px.
   - **button-tester** → adds touched routes to `tests/e2e/routes.json`, runs `tests/e2e/all-buttons.spec.ts`.
5. Read both reports. Each bug they found is an **app** bug: fix it in the main session (inside the scope), never by changing the expectation, skipping, or adding `data-e2e-skip` / `skipText` to hide it.
6. Run the full check: `node .claude/scripts/verify.mjs`. It includes the `e2e` step and records the browser pass that the UI gate looks for. If the e2e step says SKIPPED, Playwright isn't set up yet — go back to step 2.
7. Maximum 3 failing rounds (the verify script counts them). After round 3: stop fixing, report what still fails, and ask the user how to proceed.

## Report

```
## ui-verify: PASS | FAIL | BLOCKED
Acceptance criteria: AC1 PASS · AC2 PASS · ...
e2e: tests/e2e/<slug>.spec.ts -> x passed (round n/3)
All buttons: <routes> -> passed | <route> "<label>" -> <error>
Bugs fixed: <file:line — what> | none
Still failing / needs the user: ... | none
```
