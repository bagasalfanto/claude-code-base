---
paths:
  - "firestore.rules"
  - "firestore.indexes.json"
  - "storage.rules"
  - "firebase.json"
  - "{src/,}{lib/firebase,firebase,db,lib/db}/**"
  - "scripts/seed*"
---

# Active database: Firebase (Cloud Firestore) + Next.js

## Structure
- Client SDK (`firebase`) for the browser in `lib/firebase/client.ts`. Admin SDK (`firebase-admin`) **only on the server** in `lib/firebase/admin.ts` (`import "server-only"`).
- Rules: `firestore.rules`, indexes: `firestore.indexes.json`, emulator config: `firebase.json`.
- Seeder: `scripts/seed-firestore.ts` using the Admin SDK against the **emulator** (`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`). The script refuses to run when that variable is not set.
- Document the collection structure in `docs/database.md`: collection paths, fields + types, a sample document, who may read/write.

## Data design (NoSQL)
- Design from the **queries each page needs**, not from relational tables. Ask the user which screen reads which data.
- No JOINs: denormalize data that is read together (e.g. store `authorName` on a post), and decide how that copy stays in sync.
- Subcollections for data owned by one parent that can grow (`users/{uid}/orders/{id}`). Arrays only for small bounded lists.
- Documents max 1 MiB. Never keep an ever-growing list in one document.
- Write many documents with batches or transactions (mind the per-batch operation limit; check the docs).
- `createdAt`/`updatedAt` use `serverTimestamp()`.
- Every query with multiple filters/orderings → add a composite index to `firestore.indexes.json`.

## Security rules (must)
- Default **deny all**. Open per collection and per action: `allow read: if request.auth != null && request.auth.uid == userId;`
- Validate the shape of data in rules (required fields, types, lengths) for client writes.
- Sensitive or server-computed data (role, balance, payment status) is written only through the Admin SDK on the server, never from the client.
- Rules are tested with the emulator (`@firebase/rules-unit-testing`) for: owner allowed, other user denied, logged-out denied.

## Never
- `allow read, write: if true;` or rules left open "temporarily".
- Seeding/deleting data in the real Firebase project. `firebase deploy` and `firestore:delete` without the user's permission (the hook blocks/asks).
- A service account JSON in the repo or on the client.
