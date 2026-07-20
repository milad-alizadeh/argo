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

Before editing a skill, run the `writing-great-skills` failure-mode check. A
structural rewrite — moving content between disclosure tiers, changing step order —
earns a before/after eval on a fixture: run the skill both ways and diff the
process. A pure sediment strip needs only the check that no directive left with the
deleted prose.
