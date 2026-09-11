---
name: pixel-review
description: Judge a UI change by its pixels against the design ticket, in a fresh context. Use after building UI work before the PR opens, or when the user asks for a screen to be checked visually.
---

# Pixel Review

Applies when the working diff touches anything rendered: components, styles, isolated-state
cases, web source. If nothing renderable changed, say so and stop.

## 1. Name the scope

Read the diff and the ticket. Name every affected visual state, the implementation worktree path,
its HEAD commit, and the design ticket number or branch. This is a state map, not evidence: do
not render, select, or pass screenshots to the reviewer.

If nothing renderable changed, say so and stop. If the design ticket is unknown, report visual
verification unavailable to the caller, for `/ship` to carry into the PR body, and stop.

Done when the reviewer can reproduce each changed state from the state map and immutable commit.

## 2. Give the reviewer custody of the evidence

Hand the review to a fresh context that never saw the implementation reasoning or its renders
(Claude Code: a separate agent via the `Agent` tool; other harnesses: a new session). Give it
only the ticket's acceptance criteria, or the user's spec, verbatim, and the state map. The
reviewer, not the implementer, gets the artifacts.

The reviewer reads `docs/design-stack.md`, resolves the design ticket, and creates its own temp
directory. The state map is a lead, not a limit: the reviewer derives the final state set from
the ticket and design before it captures anything. It then does all of this itself:

1. Fetches the design branch and renders its page at each affected state. It reads the page from
   `FETCH_HEAD`, not a local branch name. If the branch was reaped, it obtains the state renders
   from the design ticket instead.
2. Renders the project's foundations specimen when the stack names one.
3. Runs the project-declared shipped-screen capture in the implementation worktree. If there is
   none, it builds Storybook or runs the project's development server and captures each state.
4. Records an evidence manifest: design ticket and source commit, design-render paths,
   foundations-render path when present, product-capture paths, and the state mapping.

The reviewer compares those artifacts control by control. It answers one question: do the
shipped pixels satisfy this spec? Its verdict is pass or fail, with findings that name the
product screenshot, the reference screenshot, what differs, and the spec line it violates.

An artifact the reviewer cannot resolve makes visual verification unavailable. It is never a
pass, and the reviewer states which artifact is missing and why. A supplied artifact can help
the reviewer find a command, but it is not evidence until the reviewer regenerated or independently
resolved it.

If you cannot reach any fresh context, stop here and say so. One Claude Code case: agents
running inside a `Workflow` have no `Agent` tool, so the orchestrator runs the reviewer as its
own stage. Done when the reviewer returns the manifest and a pass, fail, or unavailable verdict.

## 3. Fix loop

Findings go back to implementation: fix, re-render, re-judge, at most two rounds. Still
failing after that: stop, and hand the unresolved findings back to the caller. Say which of them
is a fundamental miss (wrong layout, missing states). That is an input to how the PR opens, and
this skill runs before there is a PR: the call is the caller's, taken when they run `/ship`.

## 4. Hand the verdict to `/ship`

Delete the temp dir and hand the caller words: the verdict, the findings that survived step 3,
and, per affected component, where the reviewer sees it live. That last one is whichever the
project has:

- **A hosted component site** (`docs/design-stack.md` names one here): the deep link per
  component. It tracks the default branch, so say that a state this branch adds appears there
  after the merge.
- **A render command**: the command and the state names, for the reviewer to run.

`/ship` writes what you hand back into the PR body.

Done when the caller has the verdict, the findings, and one link or command per affected
component, and the temp dir is gone.
