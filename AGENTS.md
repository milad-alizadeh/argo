# Argo

Argo contains the skills bundle and the Electron cockpit in `apps/desktop`.
`apps/macOS` is deprecated and kept for reference.

## Where things are written down

- For `apps/desktop` changes, read `apps/desktop/AGENTS.md` before editing.
- For issue work, use `gh`; read `docs/agents/issue-tracker.md`. For triage, also read
  `docs/agents/triage-labels.md`. Label an issue in its `gh issue create` call.
- For domain terms, read `docs/agents/domain.md` and `CONTEXT.md`. Use the model's words.
- For decisions, read the relevant `docs/adr/` files. Name any ADR your change contradicts.
- Before editing hooks, read the `$comment` fields in `hooks.json`.
- Before adding, removing, or renaming a skill, read `packages/argo-skills/README.md`.
- Before writing agent instructions, load `/writing-for-agents`.
- For issues, PR text, and other published prose for people, load `/simple-english`.
- For work with at least three steps, multiple changed files, or an approved plan, use
  `packages/argo-skills/skills/setup-argo-skills/templates/task-tracking.md`.

## Work and land

Make every change, including docs and configuration, in a worktree under
`.claude/worktrees/`. Read-only work may stay in the main checkout. Naming,
resuming, recovery, and subagents: `docs/agents/worktrees.md`.

CI is the gate; `bun run quality` is the local subset. When a gate fails, fix it or
ratchet `biome.jsonc`: never suppress inline or raise a global cap. See
`docs/agents/quality-gates.md` for fail-open checks. For a Node major switch,
reinstall dependencies because `node-pty` is bound to the ABI.

Only `/ship` pushes a work branch or opens a PR. Otherwise, review the diff once,
fix actionable findings, and commit on the work branch. Declare removals and
reversions with the trailers in `docs/agents/landing.md`. The human merges.

For a Swift change, state in the PR body whether it was checked by hand;
`apps/macOS` has no automated gate. Desktop release rules are in ADR-0036 and
`apps/desktop/README.md`.

## Code

- Ground external API calls in declarations, an existing call site, or current
  documentation opened this session. If none is available, say so.
- Use full words in names, except domain acronyms and platform-fixed names.
- Branch on a closed set with an exhaustive construct; use a lookup when it only
  selects a value.
- Validate outside data at its boundary. Reject, report, and count unrecognised shapes.
- Keep one source of truth. Add no knob, layer, or hook without a current need.
- Write Node scripts as `.mts`, apart from the exceptions in `biome.jsonc`.

When writing tests or fixing a bug, read `docs/agents/testing.md`.

Keep comments to one line unless a falsifiable fact needs more. Cut history and
restatements; a bare issue number is enough for an issue reference.

## Tooling (RTK)

Prefix shell commands with `rtk`. Trust its filters in each new worktree. Read
`docs/agents/rtk-filters.md` for setup; use `RTK_DISABLED=1 git diff` for a
complete review diff.

## Visual verification

Keep captures temporary: inspect them, then delete them. For macOS visual work,
read `docs/agents/visual-verification.md`.
