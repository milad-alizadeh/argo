---
paths:
  - "packages/argo-skills/skills/**/SKILL.md"
  - "apps/*/.claude/skills/**/SKILL.md"
---

# Skill Authoring

A `SKILL.md` is standing imperative instruction: what the agent does now. The house standard is
the `writing-for-agents` skill (mattpocock/skills), which owns sediment, duplication, negation,
disclosure and completion criteria. This file states only the Argo deltas.

- **Harness-agnostic.** A harness-specific tool is named with its generic fallback in the same
  breath ("Claude Code: `EnterWorktree`; other harnesses: `git worktree add`"), and repo-level
  wiring lands in `AGENTS.md`, never `CLAUDE.md` alone. Check: grep the finished skill for
  harness tool names; each hit carries a fallback or says it is exclusive by design.
- **Project-agnostic.** A bundled skill derives the target's root, manifest and scripts at run
  time; a skill scoped to Argo alone says so in its description. Check: grep the finished skill
  for repo-specific literals; each is derived, a documented placeholder, or installed payload.
- **The installed payload is not duplication.** What a skill writes into a target repo may
  repeat what `AGENTS.md` or `rules/` say here.

A structural rewrite (moving content between disclosure tiers, reordering steps) earns a
before/after run on a fixture. A sediment strip needs only the check that no directive left
with the deleted prose.
