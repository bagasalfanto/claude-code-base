@AGENTS.md

# Claude Code

- How we work (flow, scope, testing, safety): `.claude/rules/00-core-rules.md`. Area rules load automatically from `.claude/rules/` by path.
- Process skills come from Matt Pocock's skills (installed into `.claude/skills/`); this kit adds `scope-lock`, `ui-verify`, `db-change`, `retro-apply`, `kit-setup`.
- Status of the current work: `node .claude/scripts/scope.mjs status`. All checks: `node .claude/scripts/verify.mjs`.
- Personal, uncommitted notes go in `CLAUDE.local.md`.

<!-- /setup-matt-pocock-skills appends an "## Agent skills" section below. Keep it. -->
