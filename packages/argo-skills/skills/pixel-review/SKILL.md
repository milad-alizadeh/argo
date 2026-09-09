---
name: pixel-review
description: Judge a UI change by its pixels against the design ticket, in a fresh context. Use after building UI work before the PR opens, or when the user asks for a screen to be checked visually.
---

# Pixel Review

Applies when the working diff touches anything rendered: components, styles, isolated-state
cases, web source. If nothing renderable changed, say so and stop.

## 1. Render the affected states

Resolution order, first hit wins:

1. **Project-declared**: the render command in `docs/design-stack.md`, or a "Visual
   verification" section in the project doc that spells out how to render states.
2. **Storybook** (`.storybook/` exists): build it and screenshot each story of every
   component the diff touched.
3. **The design's page**: the design ticket's branch holds it. Read it out without a checkout
   and screenshot the `file://` URL:

   ```sh
   git fetch origin 'design/#<N>-<screen>'
   git show FETCH_HEAD:design.html > "$TMPDIR/<screen>.html"
   ```

   `FETCH_HEAD`, not the branch name: fetching one branch writes no local head, so the branch
   name resolves to nothing and the failure reads exactly like a reaped branch. The page is
   self-contained, so that one file is the whole design.

   A branch that is gone means the screen shipped and its page was reaped. Judge against the
   state renders on the design ticket, which are the spec, and move on.
4. **Dev server**: a `dev`/`start` script; launch it and navigate to the screens the ticket
   names.
5. **Nothing renderable found**: report "visual verification unavailable" to the caller, for
   `/ship` to carry into the PR body, and stop.

Use `scripts/screenshot-states.mjs` if the project has it; otherwise drive headless Chromium
inline with a fixed viewport and animations disabled.

Done when there is one PNG per affected state, named after the state, in a temp dir.

## 2. Judge with fresh eyes

Hand the judging to a fresh context that never saw the render or your reasoning (Claude
Code: a separate agent via the `Agent` tool; other harnesses: a new session seeded with only
the inputs below). Its only inputs:

- the ticket's acceptance criteria, or the user's spec, verbatim;
- the design ticket's state renders and the foundations specimen, if the project has them;
- the screenshots.

The judge answers one question, do these pixels satisfy this spec, and returns pass/fail
plus findings, each naming the screenshot, what is wrong, and which spec line it violates.

If you cannot reach any fresh context, stop here and say so. One Claude Code case: agents
running inside a `Workflow` have no `Agent` tool, so the orchestrator runs the judge as its
own stage.

## 3. Fix loop

Findings go back to implementation: fix, re-render, re-judge, at most two rounds. Still
failing after that: stop, and hand the unresolved findings back to the caller. Say which of them
is a fundamental miss (wrong layout, missing states). That is an input to how the PR opens, and
this skill runs before there is a PR: the call is the caller's, taken when they run `/ship`.

## 4. Hand the evidence to `/ship`

Pass or fail, the final screenshots belong in the PR body so the human reviews pixels — and
this skill runs before any PR exists. Publish them under a throwaway ref so they never merge,
following `PR-EVIDENCE.md` beside this file, and hand the caller the pinned URLs with the
findings. `/ship` is what writes them into the body.

Done when every final PNG has a URL pinned to that commit, and the caller has the list.
