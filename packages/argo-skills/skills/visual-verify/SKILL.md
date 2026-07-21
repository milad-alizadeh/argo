---
name: visual-verify
description: Verify UI changes visually — render the affected states, screenshot them, and have a fresh agent judge the pixels against the spec. Use after implementing UI work before the PR opens, or on demand when the user wants a screen visually checked.
---

# Visual Verify

Code review reads the diff; this reads the pixels — the class of bug where the code looks right
but the render is wrong (spec says "inline icons with text", the app stacks them).

## Gate

Applies when the working diff touches anything rendered: components, styles, stories, design
studies, renderer/web source. If nothing renderable changed, say so and stop.

## 1. Render the affected states

Resolution order — first hit wins:

1. **Project-declared** — IF a "Visual verification" section in the project's `AGENTS.md`
   spells out how to *render* states, follow it. Such a section may instead document only a
   CI screenshot gate (baseline diffing) and give no interactive render method — in that
   case fall through to the next option rather than dead-ending here.
2. **Storybook** (`.storybook/` exists) — `build-storybook`, serve the static build on a free
   port, and render the changed components' stories via
   `iframe.html?id=<story-id>&viewMode=story`. The affected states are the stories of every
   component the diff touched.
3. **Design studies** (design-handoff project) — screenshot the study HTML directly via
   `file://`.
4. **Dev server** — a `dev`/`start` script in package.json: launch it, navigate to the
   screens the ticket names.
5. **Nothing renderable found** — record "visual verification unavailable" in the PR body and
   stop. Never silently pass.

Screenshot mechanics: use `scripts/screenshot-states.mjs` if the project has it (installed by
the `setup-visual-verify` skill — deterministic viewport, animations disabled); otherwise drive
headless Chromium/Playwright inline with the same settings. Write screenshots to a temp dir,
one PNG per state, named after the state.

## 2. Judge with fresh eyes

Hand the judging to a **fresh context** — one that never saw the render or your reasoning
(Claude Code: spawn a separate agent with the `Agent` tool; other harnesses: open a new
session/conversation seeded with only the inputs below and paste its verdict back). Its only
inputs:

- the ticket's acceptance criteria (or the user's spec, verbatim);
- the design references — settled study, foundations specimen — if the project has them;
- the screenshots.

Deliberately **not** the diff and not your reasoning: the implementer grading its own render
mostly returns "looks right". The judge answers one question — do these pixels satisfy this
spec? — and returns a structured verdict: pass/fail plus findings, each naming the
screenshot, what is wrong, and which spec line it violates.

**If you cannot reach any fresh context, stop here and say so.** Judging your own render is the
failure this step exists to prevent, not a weaker version of it. One Claude Code case: agents
running inside a `Workflow` have no `Agent` tool, so the orchestrator must run the judge as its
own stage instead.

## 3. Fix loop

Findings go back to implementation: fix, re-render, re-judge. **Max two rounds.** Still
failing after that → proceed, but list the unresolved findings in the PR body; if the miss is
fundamental (wrong layout, missing states), open the PR as draft.

## 4. Evidence in the PR

Pass or fail, the final screenshots go in the PR so the human reviews pixels, not just a
diff. Don't commit them to the branch — that carries them into `main` on merge. Publish them
under a throwaway ref instead, from the dir holding the PNGs (`$SHOTS`):

```sh
slug=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
tree=$(for f in "$SHOTS"/*.png; do
  printf '100644 blob %s\t%s\n' "$(git hash-object -w "$f")" "$(basename "$f")"
done | git mktree)
commit=$(git commit-tree "$tree" -m "visual-verify: $slug")
git push --force origin "$commit:refs/pr-screenshots/$slug"
```

Embed each with a raw URL pinned to that commit — it renders inline during review and is
reaped by `worktrees:gc` once the PR closes:

```markdown
![status-row](https://raw.githubusercontent.com/<owner>/<repo>/<commit>/status-row.png)
```
