---
paths:
  - "{src/,}app/**/*.{tsx,jsx,css}"
  - "{src/,}components/**"
  - "{src/,}hooks/**"
  - "{src/,}styles/**"
  - "public/**"
---

# Frontend: Next.js (App Router)

Before writing UI, check versions in `package.json` (next, react, tailwindcss) and follow the existing component patterns.

## Must
- **Server Components by default.** `"use client"` only for components that need state, event handlers, effects, or browser APIs. Put `"use client"` as low in the tree as possible.
- Fetch data in Server Components or through server actions/route handlers. Never fetch your own API from a Server Component; call the server function directly.
- Every data-fetching page has a **loading** state (`loading.tsx`/Suspense), an **error** state (`error.tsx`), and an **empty** state (with copy the user approved).
- Forms: client-side validation for UX, but the authoritative validation is on the server. Show per-field errors. Disable the submit button and show progress while pending (`useActionState`/`useFormStatus`).
- All UI copy, labels, and error messages exactly as in the ticket or scope card. If it is not there, ask the user.
- Accessibility: interactive elements use real `<button>`/`<a>` (not `div onClick`), a `label` for every input, `alt` on images, enough contrast, usable by keyboard.
- Images with `next/image`, internal links with `next/link`, fonts with `next/font`.
- Styling: follow the system already in use (Tailwind/CSS Modules/existing UI components). No new UI library without the user's permission.
- Responsive at least at 375px (phone) and 1280px (desktop).
- Dangerous buttons (delete, logout, pay) get `data-e2e-skip` and a confirmation before acting.

## Never
- Secrets, or `process.env.X` without the `NEXT_PUBLIC_` prefix, in client components.
- `useEffect` to fetch data that could be fetched on the server, or to compute derived state.
- `any`, `@ts-ignore`, `eslint-disable` to hide errors.
- Changing shared components (`components/ui/**`, global layout) outside the approved scope without permission.

## References
- React/Next performance: `vercel-react-best-practices` skill. Visual design: `frontend-design` skill. UI/accessibility audit: `web-design-guidelines` skill.
