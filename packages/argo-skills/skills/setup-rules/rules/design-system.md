---
paths:
  - "{{RENDERER_GLOB}}"
---

# Design System

Style every UI through **design tokens** surfaced as **Tailwind v4 utility classes**,
never as raw values or inline style objects. Two hard rules, no exceptions outside the
documented escape hatches.

## Rule 1 — Tokens only, never magic numbers

Every visual constant lives in the `@theme static {}` block in `{{TOKENS_CSS}}` — the
single source of truth for colors, font weights, line-heights, letter-spacing, radii,
component sizes, durations, opacity, z-index. Tailwind v4 turns each
`--color-*`/`--spacing-*`/etc. entry into both a `:root` custom property and a utility
class automatically.

- **Never** hardcode a hex/rgb/hsl color, a px/rem/em size, a duration, or an opacity
  anywhere — not in a class, not in a style, not in code.
- Need a value that doesn't exist yet? **Add a token** to the `@theme` block first,
  then use its generated utility class. Don't inline the raw value.

## Rule 2 — Classes/utilities, never inline styles

Style with `className` and Tailwind utilities. **Do not** use static `style={{ ... }}`
objects. Dynamic per-state styling → **swap classes**, don't compute inline styles:

```tsx
const tone = active ? 'bg-accent text-text-on-accent' : 'bg-bg-input text-text-faint'
return <button className={`px-4 py-2.5 rounded-lg ${tone}`}>Send</button>
```

## Escape hatches (the ONLY allowed inline styles)

Use an inline style **only** for a value the class system genuinely cannot express,
with a comment saying why:

1. **Truly dynamic runtime values** — e.g. `style={{ height: `${height}px` }}`, where
   the number comes from runtime, not a token.
2. **Platform-only CSS with no utility class** — e.g. a desktop-shell property like a
   draggable window region. Keep it inline with a comment.

Everything else is a bug — convert it to classes + tokens.

## Non-token surfaces

A canvas/WebGL surface outside Tailwind's reach (a terminal emulator, a charting
canvas, a map view) pulls token values via `getComputedStyle` on a host element and
keeps its theme constants as named `const`s at the top of the component — never bare
magic numbers inline.

## Checklist before you finish styling work

- [ ] No hex/rgb/px/rem/ms literals (except token defs in the tokens file).
- [ ] No inline `style={{}}` except the two escape hatches above, each commented.
- [ ] Any new visual value added to the `@theme` block first.
- [ ] Typecheck succeeds.

## Figma canvas work

If building in Figma: load Figma's own skills (`figma-use`, then
`figma-generate-design` / `figma-generate-library`) before any `use_figma` call —
they own the HOW. On top of that: run the discovery checklist before any mutation
(reuse existing components/variables, don't rebuild from primitives), assemble one
section per `use_figma` call, and screenshot after each section lands.
