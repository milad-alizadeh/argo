---
name: pixel-review
description: Judge a UI change by its pixels against the approved design, in a fresh context. Use after building UI work before the PR opens, or when the user asks for a screen to be checked visually.
---

# Pixel Review

Applies when the working diff touches anything rendered: components, styles, isolated-state
cases, approved designs, web source. If nothing renderable changed, say so and stop.

## 1. Render the affected states

Resolution order, first hit wins:

1. **Project-declared**: the render command in `docs/designs/stack.md`, or a "Visual
   verification" section in the project doc that spells out how to render states.
2. **Storybook** (`.storybook/` exists): build it and screenshot each story of every
   component the diff touched.
3. **Approved designs**: screenshot the design HTML in `docs/designs/` via `file://`.
4. **Dev server**: a `dev`/`start` script; launch it and navigate to the screens the ticket
   names.
5. **Nothing renderable found**: record "visual verification unavailable" in the PR body and
   stop.

Use `scripts/screenshot-states.mjs` if the project has it; otherwise drive headless Chromium
inline with a fixed viewport and animations disabled.

Done when there is one PNG per affected state, named after the state, in a temp dir.

## 2. Judge with fresh eyes

Hand the judging to a fresh context that never saw the render or your reasoning (Claude
Code: a separate agent via the `Agent` tool; other harnesses: a new session seeded with only
the inputs below). Its only inputs:

- the ticket's acceptance criteria, or the user's spec, verbatim;
- the approved design's render and the foundations specimen, if the project has them;
- the screenshots.

The judge answers one question, do these pixels satisfy this spec, and returns pass/fail
plus findings, each naming the screenshot, what is wrong, and which spec line it violates.

If you cannot reach any fresh context, stop here and say so. One Claude Code case: agents
running inside a `Workflow` have no `Agent` tool, so the orchestrator runs the judge as its
own stage.

## 3. Fix loop

Findings go back to implementation: fix, re-render, re-judge, at most two rounds. Still
failing after that: proceed, list the unresolved findings in the PR body, and open the PR as
draft if the miss is fundamental (wrong layout, missing states).

## 4. Evidence in the PR

Pass or fail, the final screenshots go in the PR so the human reviews pixels. Publish them
under a throwaway ref so they never merge, following `PR-EVIDENCE.md` beside this file.

Done when every final PNG is embedded in the PR body by a URL pinned to that commit.
