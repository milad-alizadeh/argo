# Code review

The installed `/implement` skill owns review invocation, verification order, the reviewer brief, and review after fixes.
The installed `/code-review` skill defines the Standards and Spec axes.
Argo uses upstream `/implement` rather than shipping its own copy (ADR-0012).

Read `AGENTS.md` → *Gates* and `.github/workflows/ci.yml` for current gate commands and conditions.
`bun run quality` is the local subset, not the whole CI workflow.
If an installed skill lists older gate commands, use these repository sources.

A focused test names a single file or package, such as `node --test hooks/guards.test.mjs`.
`bun run test:hooks` runs the whole hook suite and does not qualify for the reviewer exception.
A filter that selects no tests proves nothing, even when the command exits successfully.

The `/ship` skill owns updating from the current base, gate runs at shipping time, pushing, and opening the PR.
`AGENTS.md` → *Landing* records the boundary between implementation and shipping.
Merging remains the human's step.
