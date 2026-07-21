---
paths:
  - "packages/argo-skills/skills/**/SKILL.md"
  - "apps/*/.claude/skills/**/SKILL.md"
---

# Skill Authoring

A `SKILL.md` is standing imperative instruction — what the agent does *now*. The
house standard is `writing-great-skills` (mattpocock/skills); read it for the full
vocabulary (sediment · no-op · duplication · sprawl · negation). This file states
only the Argo deltas.

- **No sediment.** Decision history, PR/issue numbers offered as justification,
  dated war-stories ("the earlier trap was…"), captured test results
  ("verified: …"), and multi-paragraph rationale do not belong in a skill.
  Rationale lives in the ADR; history lives in the commit message. A line that
  explains *why a past decision was made* instead of *what to do now* gets deleted.
- **Rationale is one clause, and only when it changes what the agent does** — the
  same bar as `comments.md`. Cut trailing "— which is what makes X the Y"
  justifications.
- **Point, don't restate.** Mechanics owned by `AGENTS.md`, `rules/`, or another
  skill get a pointer, not a copy. (The payload a skill *installs* into a target
  repo is not duplication.)
- **Checkable completion.** End each step on a condition the agent can verify
  ("grep the installed files for any remaining `{{`"), not "produce a list".
- **Prompt the positive.** Keep a prohibition only as a guardrail you cannot phrase
  positively, and pair it with the action that replaces it.
- **Harness-agnostic.** Prefer a harness-neutral instruction. When you must name a
  harness-specific tool or feature (`Agent`, `Workflow`, `EnterWorktree`, a slash
  command, an output style), pair it with the generic fallback in the same breath
  ("Claude Code: `EnterWorktree`; other harnesses: `git worktree add`"), and land
  repo-level wiring in `AGENTS.md`, not `CLAUDE.md` alone. A capability genuinely
  exclusive to one harness (output styles) is kept, but says so. **Check:** grep the
  finished skill for harness tool names — each hit has a paired fallback or an
  explicit exclusive-by-design note — and confirm any repo-level wiring it installs
  targets `AGENTS.md` (or both files), never `CLAUDE.md` alone.
- **Project-agnostic.** A bundled skill installs into arbitrary repos, so it must not
  assume *this* project's paths, package names, or commands. Derive them at run time
  (`git rev-parse --show-toplevel` for the root; read the target's manifest for its
  scripts) rather than hardcoding `packages/argo-skills`, `apps/desktop`, or an Argo
  script name. A skill deliberately scoped to Argo alone says so in its description.
  **Check:** grep the finished skill for repo-specific literals — each is either
  derived, a documented placeholder, or the payload it installs.

Before editing a skill, run the `writing-great-skills` failure-mode check. A
structural rewrite — moving content between disclosure tiers, changing step order —
earns a before/after eval on a fixture: run the skill both ways and diff the
process. A pure sediment strip needs only the check that no directive left with the
deleted prose.
