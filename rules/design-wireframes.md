---
paths:
  - "docs/wireframes/**"
  - "apps/desktop/src/renderer/src/**/*.{css,tsx,jsx}"
---

# Design Wireframes

Exploratory UI design studies — the throwaway HTML mockups you produce while exploring
a screen's layout, palette, or interaction model — are a **committed repo artifact**,
not scratch files.

## Rule — studies live in `docs/wireframes/`, committed

- When you generate an HTML design study (via `frontend-design`, `prototype`, an ad-hoc
  mockup, or a fan-out design pass), write the keepers to `docs/wireframes/`, not to a
  temp/scratchpad directory. Scratchpad output gets swept — anyone else on the repo then
  can't see the design you settled on.
- `docs/wireframes/` holds only the **agreed-latest** set. When a study supersedes an
  earlier one, delete the stale file in the same change — don't accumulate v1…v7. A
  reader opening the directory should see the current direction, not the archaeology.
- Keep a `docs/wireframes/README.md` index: one row per file (screen · what it is). Update
  it whenever you add or prune a study.
- `docs/` is excluded from the code knowledge graph (`.graphifyignore`), so committing
  HTML studies here never pollutes the graph.

## Why not scratchpad

The harness default sends temp files to a session scratchpad that is later cleaned up.
Design decisions are durable team artifacts — they belong in version control where every
agent and teammate on the repo can open them, diff them, and build the real UI from them.
