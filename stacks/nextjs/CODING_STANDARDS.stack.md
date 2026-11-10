
## Next.js

- Server Components by default; `"use client"` only for interactivity, as low in the tree as possible. (Smaller bundles, fewer waterfalls.)
- Data access lives in `lib/` (server-only); components don't talk to the database directly. (One place for auth checks.)
- Every Server Action and Route Handler checks auth and validates input with Zod, even if the UI already did. (Actions are public endpoints.)
- Loading, empty, and error states are part of the feature, not polish.
- No `any`; narrow unknown data with a schema. (Types are only as good as their edges.)
