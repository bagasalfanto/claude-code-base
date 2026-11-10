# tests/e2e

| File | Contents | Owner |
|---|---|---|
| `all-buttons.spec.ts` | Clicks every button/link on each route in `routes.json`. Fails on a JS crash, console error, 5xx response, or a dead internal link. | button-tester |
| `routes.json` | Routes under test + button labels to skip (delete/logout/pay). | button-tester |
| `<feature>.spec.ts` | One test per acceptance criterion of a feature. | ui-tester |
| `.auth/` | Saved login state from test setup (gitignored). | ui-tester |

## Running
```
npx playwright test                              # everything
npx playwright test tests/e2e/all-buttons.spec.ts
npx playwright test --project=desktop            # one viewport
npx playwright show-report                       # HTML report
```

## Test accounts
Accounts used by e2e logins are created by a seeder (see `docs/database.md`). List the test account emails here, never real passwords:
- NOT FILLED

## Buttons that must never be clicked automatically
Add the `data-e2e-skip` attribute to the element (e.g. "Delete account") and note the reason in the feature spec.
