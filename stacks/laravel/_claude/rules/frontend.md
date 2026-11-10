---
paths:
  - "resources/views/**"
  - "resources/js/**"
  - "resources/css/**"
  - "app/View/**"
  - "app/Livewire/**"
  - "lang/**"
---

# Frontend: Laravel (Blade / Livewire / Inertia)

The project's frontend mode is recorded in `.claude/kit.config.json` → `frontend` and in AGENTS.md. Follow that mode; don't mix modes.

## Must (every mode)
- Follow the existing layouts and components (`resources/views/components`, `layouts`, or `resources/js/components`). Search before creating new ones.
- Assets through Vite (`@vite([...])`). No large inline CSS/JS or new CDNs without permission.
- All UI copy exactly as in the ticket or scope card. If the app is multilingual, copy goes through `__('...')` and files in `lang/`.
- Every form: `@csrf` (Blade), per-field validation errors (`@error` / Inertia `errors`), repopulated old input (`old()`), and a submit button disabled while processing.
- Every list page has an empty state, and pagination if the data can grow.
- Interactive elements use real `<button>`/`<a>` with clear labels. Dangerous buttons (delete/logout/pay) get `data-e2e-skip` and a confirmation.
- Accessibility: `label for`, `alt`, contrast, keyboard-usable. Responsive at 375px and 1280px.

## Blade
- Always output with `{{ }}` (escaped). `{!! !!}` only for already-sanitized HTML, and only after asking the user.
- No logic in views: prepare data in the controller/View Component.
- Use Blade components (`<x-...>`) for repeated elements.

## Livewire
- Public properties are user input: validate in `rules()`/`#[Validate]` and check authorization in every action (`$this->authorize(...)`).
- Never put sensitive data in public properties (they are visible in the browser).
- `wire:loading` for slow actions. `wire:model.live` only when real-time is truly needed.

## Inertia (React/Vue)
- Keep controller props minimal (select fields, never send whole models). Use `useForm` for forms and show `errors`.
- Page components in `resources/js/Pages` (or `pages`, follow what exists). For React, refer to the `vercel-react-best-practices` skill (React parts only).

## Never
- Database queries in views/Blade components.
- New JS/CSS libraries or UI frameworks without the user's permission.
- Changing the global layout or shared components outside the approved scope.
