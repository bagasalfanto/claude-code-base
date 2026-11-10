---
paths:
  - "app/Models/**"
  - "app/Services/**"
  - "app/Repositories/**"
  - "config/firebase.php"
  - "firestore.rules"
  - "firestore.indexes.json"
  - "firebase.json"
  - "database/seeders/**"
---

# Active database: Firebase (Cloud Firestore) + Laravel

Laravel has no Eloquent driver for Firestore. Access goes through the Firebase Admin SDK for PHP. The commonly used package is `kreait/laravel-firebase`, but **confirm with the user** before installing it.

## Structure
- Firestore access is wrapped in repository/service classes (`app/Repositories/` or `app/Services/Firestore/`), one per collection. Controllers never call the SDK directly.
- Data is mapped to clear DTOs/arrays, never raw documents passed to views.
- Rules: `firestore.rules`, indexes: `firestore.indexes.json`, emulator: `firebase.json`.
- Seeder: a command/seeder that writes to the **emulator** (`FIRESTORE_EMULATOR_HOST`) and refuses to run when that variable isn't set.
- The collection structure is documented in `docs/database.md` (paths, fields + types, a sample document, who may read/write).
- If the app still needs relational tables (users, sessions, jobs), ask the user: MySQL/SQLite for those and Firestore for specific data?

## Data design (NoSQL)
- Design from the queries each page needs. No JOINs, so denormalize and decide how copies stay in sync.
- Subcollections for data owned by one parent that can grow. Documents max 1 MiB. Batches/transactions for bulk writes (check the per-batch operation limit in the docs).
- Queries with several filters/orderings → add composite indexes.

## Security rules (required if the client accesses Firestore directly)
- Default deny all. Open per collection and action based on `request.auth.uid`. Validate data shape in rules.
- Server-computed data (role, balance, payment status) is written only from Laravel (Admin SDK).

## Never
- Open rules (`if true`). Seeding/deleting data in the real Firebase project. `firebase deploy`/`firestore:delete` without permission.
- A service account JSON in the repo, in `public/`, or sent to the client.
