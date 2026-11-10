# Coding standards

Judgement rules that a linter can't check. Matt's `/code-review` reviews every change against this file (the "Standards" axis), and `/retro` + the kit's `retro-apply` skill add lines here when a lesson can't be turned into an automated check.

Keep each rule to one line with a short reason. Delete rules that no longer earn their place. Rules that a tool can enforce belong in the linter / `verify` steps, not here.

## General

- Prefer the obvious solution; no abstraction until the second real use. (Speculative layers cost more than duplication.)
- Names come from `GLOSSARY.md`. One concept, one name across UI, code, and database. (Synonyms cause bugs.)
- Functions do one thing at one level of abstraction; a comment explains *why*, not *what*.
- Handle errors where you can do something useful; otherwise let them surface. Never swallow an error silently.
- Validate at the boundary (request, form, external API), trust inside. (One place to fix.)
- No secrets, tokens, or personal data in code, logs, fixtures, or seeds.
- Tests describe behaviour through public interfaces at the agreed seams, not implementation details. (Refactors shouldn't break tests.)
- A change touches only what its ticket needs. Refactors get their own ticket.
