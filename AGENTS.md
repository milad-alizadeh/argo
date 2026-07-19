# Argo

Monorepo for the Argo skills/plugin **and** the Argo cockpit app. Read by both Claude Code and Codex.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues on `milad-alizadeh/argo`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Rules

House engineering rules live in `.claude/rules/`. Load the ones matching the files you
touch (each rule's `paths:` frontmatter states its scope):

- **All code** — `engineering-principles.md`, `comments.md`, `file-structure.md`,
  `typescript-style.md`, `dependencies.md`
- **UI work** — also `ui-components.md`, `design-system.md`
