---
paths:
  - "docs/designs/**"
  - "{{RENDERER_GLOB}}"
---

# Design Studies

The designs produced while exploring a screen's layout, palette or interaction model are a
**committed repo artifact**, never scratch files.

**This file's spelling is HTML studies in `docs/designs/` plus named skills; its rules are
the intents.** On a stack whose studies take another form (a Storybook playground, a Figma
file), or where those skills aren't installed, rewrite the mechanism and keep the intents
(`setup-rules` §3): studies are committed and indexed; the directory holds the agreed-latest
set only; studies are authored from the token contract and the component tiers; a settled
study is a spec, never a source. A named skill not installed here degrades to its manual step,
stated in this file, never to a pointer at a skill the agent can't run.

## Studies live in `docs/designs/`, committed

Write the keepers there, not to a scratchpad that gets swept. When a study supersedes an
earlier one, delete the stale file in the same change. Keep the `docs/designs/README.md`
index current: one row per file.

## Component-first authoring, so designs transfer

- **Tokens first.** Every study starts from the vocabulary in `{{TOKENS_CSS}}`. A value the
  contract lacks is a **proposal**: snapped to an existing token or promoted to a named one
  when the study settles, never ported raw.
- **Foundations before screens.** The ramps are designed once (`setup-design-foundations`)
  and rendered as `docs/designs/foundations.html`, the one non-disposable study because it
  styles only via `var(--token)`. Screens propose; they never redefine.
- **Name every region** with a stable `data-component="SessionRow"` attribute. The name
  survives into the inventory, the codebase and the tickets.
- **Compose from the kit** (`docs/designs/kit.js`): recurring atoms and molecules are named
  render functions a study calls, never re-writes.
- **Ship the inventory.** A settled study carries a component-inventory table (name, tier,
  props, composed-of) beside it. The inventory, not the HTML, is the build contract
  `design-to-code` consumes.

## The study is a spec, never a source

Building a screen means rebuilding from tokens and existing components, never copying study
markup or styles. When the app and a settled study disagree, fix whichever is wrong in the
same change.
