---
name: setup-visual-verify
description: Install visual verification in a project — a deterministic screenshot script plus an AGENTS.md section declaring how to render UI states — so /visual-verify and the implement skills can judge pixels against specs. Run once per UI project; re-run to change the render method.
disable-model-invocation: true
---

# Setup Visual Verify

Installs the per-project half of the `visual-verify` skill. The skill itself is portable; what varies
per project is **how to render a UI state**. This setup detects that, pins it in writing, and
ships the screenshot script.

## 1. Detect the render surface

Look before asking — recommend, don't present a blank menu:

- `.storybook/` present → **Storybook** (best: stories enumerate states).
- A design-handoff studies dir → **studies** (screenshot the HTML directly).
- A `dev`/`start` script serving UI → **dev server**.
- Several present → Storybook for components, studies for unbuilt designs; say so.

Confirm the choice with the user, along with anything non-obvious you found (custom ports,
auth walls, build steps).

## 2. Install the screenshot script

Copy `templates/screenshot-states.mjs` to `scripts/screenshot-states.mjs` in the project.
It needs Playwright: use the project's existing `playwright` devDependency if there is one;
otherwise note that the `visual-verify` skill will run it via `npx playwright` and skip adding a
dependency.

## 3. Declare the method in AGENTS.md

Append a section so any agent — including one that never runs this wizard — knows how to
render states. Template, adapted to what was detected:

```markdown
## Visual verification

UI diffs are visually verified before a PR opens (see the `visual-verify` skill). To render
states in this project: <the detected method — e.g. "`bun run build-storybook`, serve
`storybook-static/` on a free port, states are story URLs via
`iframe.html?id=<story-id>&viewMode=story`">. Screenshot with
`node scripts/screenshot-states.mjs <states.json> <out-dir>`. UI tickets end with
the `visual-verify` skill; screenshots are published to a throwaway `refs/pr-screenshots/<branch-slug>`
ref (never committed to the branch) and embedded in the PR body via raw URLs.
```

## 4. Optional — pixel-diff regression tests

Distinct layer, separate opt-in: committed screenshot baselines over the project's stories
(vitest browser mode `toMatchScreenshot`, or Playwright `toHaveScreenshot` against the static
Storybook build) with a CI gate, so blessed UI can't drift silently. Offer it only when the
project has Storybook + CI; if accepted, wire it with baselines generated in **one**
environment only (CI or a container — cross-OS font rendering false-positives otherwise),
animations disabled, dynamic regions masked.
