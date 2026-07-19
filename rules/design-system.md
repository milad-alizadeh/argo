---
paths:
  - "apps/desktop/src/renderer/src/**/*.{css,tsx,jsx}"
---

# Design System

Style every UI through **design tokens** surfaced as **Tailwind v4 utility classes**,
never as raw values or inline style objects. Two hard rules, no exceptions outside the
documented escape hatches.

## Token architecture (ADR-0006)

Tokens live across **two files**, and the split is load-bearing:

- **`styles/argo-tokens.css`** — the single source of **raw values**. Every color,
  radius, size, etc. is a CSS custom property here, split by theme (`:root` = light,
  `.dark` = dark, per the shadcn convention).
- **`styles/globals.css`** — maps those raw variables onto Tailwind's theme via
  `@theme inline { --color-background: var(--background); … }`, which generates the
  `bg-background` / `text-muted-foreground` utility classes. Wiring only, no raw values.

## Rule 1 — Tokens only, never magic numbers

Every visual constant is a raw variable in `styles/argo-tokens.css`, wired into a
utility class through the `@theme inline` block in `styles/globals.css`.

- **Never** hardcode a hex/rgb/hsl color, a px/rem/em size, a duration, or an opacity
  anywhere — not in a class, not in a style, not in code.
- Need a value that doesn't exist yet? **Add the raw variable to `argo-tokens.css`
  first** (both `:root` and `.dark` if it's themed), map it in `globals.css`, then use
  the generated utility class. Don't inline the raw value.
- Prefer the shadcn semantic roles (`background`, `foreground`, `muted`, `border`, …)
  that already resolve to these variables over inventing a parallel token.

## Roles, not values — typography and spacing

Tokens are named by **role** (`--text-label`, `--space-inset`), never by their
value (`--text-10-5`, `--space-7px`). Role names are what survive a redesign and
what carry a design across frameworks; value names are drift with extra steps.

- A typography role is the **full tuple** — size + line-height + weight +
  letter-spacing — not just a font size. Components use the role's utility
  (`text-label`), never a raw size, and never Tailwind arbitrary values
  (`text-[13px]`, `p-[7px]`, `bg-[#4a5ee0]` are all forbidden in components).
- The set of roles is deliberately small (roughly: micro / label / body /
  body-lg / title / display). A new role needs a reason an existing one can't
  cover — "this looked 0.5px better in one spot" is a snap, not a new role.

## Drift — fix the contract, not the symptom

When you find a raw value in a component (yours or inherited), the fix is never
local: snap it to an existing token or promote it into `argo-tokens.css`, then
use the utility. Patching one component while the raw value's siblings survive
elsewhere is how the system rots. Same rule for the AI: when output drifts,
correct the token contract or the rules — not the one offending line.

## Rule 2 — Classes/utilities, never inline styles

Style with `className` and Tailwind utilities. **Do not** use static `style={{ ... }}`
objects. Dynamic per-state styling → **swap classes**, don't compute inline styles:

```tsx
const tone = active ? 'bg-accent text-accent-foreground' : 'bg-input text-muted-foreground'
return <button className={`px-4 py-2.5 rounded-lg ${tone}`}>Send</button>
```

## Escape hatches (the ONLY allowed inline styles)

Use an inline style **only** for a value the class system genuinely cannot express,
with a comment saying why:

1. **Truly dynamic runtime values** — e.g. `style={{ height: `${height}px` }}`, where
   the number comes from runtime, not a token.
2. **Electron shell CSS with no utility class** — e.g. a draggable window region
   (`WebkitAppRegion: 'drag'`). Keep it inline with a comment.

Everything else is a bug — convert it to classes + tokens.

## Non-token surfaces

A canvas/WebGL surface outside Tailwind's reach (a terminal emulator, a charting
canvas, the orb) pulls token values via `getComputedStyle` on a host element and
keeps its theme constants as named `const`s at the top of the component — never bare
magic numbers inline.

## Checklist before you finish styling work

- [ ] No hex/rgb/px/rem/ms literals (except token defs in `argo-tokens.css`).
- [ ] No Tailwind arbitrary values (`*-[...]`) carrying a design constant.
- [ ] No inline `style={{}}` except the two escape hatches above, each commented.
- [ ] Any new visual value added to `argo-tokens.css` + mapped in `globals.css` first.
- [ ] `bun run check:design-tokens` passes (mechanical version of the above).
- [ ] Typecheck succeeds.

## Figma canvas work

If building in Figma: load Figma's own skills (`figma-use`, then
`figma-generate-design` / `figma-generate-library`) before any `use_figma` call —
they own the HOW. On top of that: run the discovery checklist before any mutation
(reuse existing components/variables, don't rebuild from primitives), assemble one
section per `use_figma` call, and screenshot after each section lands.
