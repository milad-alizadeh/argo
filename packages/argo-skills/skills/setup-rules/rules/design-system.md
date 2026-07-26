---
paths:
  - "{{RENDERER_GLOB}}"
---

# Design System

Style every UI through **design tokens**, never as raw values or inline style objects.
Two hard rules, no exceptions outside the documented escape hatches.

**This file is written in one styling dialect — Tailwind v4 `@theme`, utility classes,
`className` — and those are its spelling, not its rules.** On a stack with a different
token layer (React Native `StyleSheet` + a theme module, Tamagui `createTokens`, vanilla
CSS custom properties), rewrite it the way `setup-rules` §3 writes a language binding: keep
the intents, re-spell every mechanism. The intents are

1. every visual constant lives in **one token source of truth**, and reaches components
   only through the token layer's named form — never as a raw literal at a call site;
2. tokens are named by **role**, not by value, and the role set stays deliberately small;
3. per-state styling **selects among named styles**; it never computes raw values inline;
4. drift is fixed at the **contract** (snap to a token or promote one), never patched at
   the one offending line.

Where a rule below reads as an absolute ("never inline `style`"), the absolute belongs to
the **mechanism** — bypassing the token layer — never to the spelling. Re-spell the escape
hatches too: every stack has values the token system genuinely cannot express, and the
binding must say where they live, or the absolutes drive them underground. And before
asserting any dialect is absent here, grep this file's own `paths:` glob (`setup-rules`
§5a) — a platform-variant file can carry the other dialect inside this rule's own scope.

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

## Roles, not values — typography and spacing

Tokens are named by **role** (`--text-label`, `--space-inset`), never by their
value (`--text-10-5`, `--space-7px`). Role names are what survive a redesign and
what carry a design across frameworks; value names are drift with extra steps.

- A typography role is the **full tuple** — size + line-height + weight +
  letter-spacing — not just a font size. Components use the role's utility
  (`text-label`), never a raw size, and never Tailwind arbitrary values
  (`text-[13px]`, `p-[7px]`, `bg-[#888888]` are all forbidden in components).
- The set of roles is deliberately small (roughly: micro / label / body /
  body-lg / title / display). A new role needs a reason an existing one can't
  cover — "this looked 0.5px better in one spot" is a snap, not a new role.
- **A type role reaches the screen through one `Text` atom, never as a class typed
  at a call site.** `className="text-label"` is a violation exactly the way
  `bg-[#888888]` is — and so is a bare string in a `div` that inherits its type. See
  `ui-components.md`, "All rendered text goes through one `Text` atom".

## Drift — fix the contract, not the symptom

When you find a raw value in a component (yours or inherited), the fix is never
local: snap it to an existing token or promote it into the tokens file, then use
the utility. Patching one component while the raw value's siblings survive
elsewhere is how the system rots. Same rule for the AI: when output drifts,
correct the token contract or the rules — not the one offending line.

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
- [ ] No Tailwind arbitrary values (`*-[...]`) carrying a design constant.
- [ ] No inline `style={{}}` except the two escape hatches above, each commented.
- [ ] Any new visual value added to the `@theme` block first.
- [ ] The design-token check script passes, if the repo has one installed.
- [ ] Typecheck succeeds.

## Figma canvas work

If building in Figma: load Figma's own skills (`figma-use`, then
`figma-generate-design` / `figma-generate-library`) before any `use_figma` call —
they own the HOW. On top of that: run the discovery checklist before any mutation
(reuse existing components/variables, don't rebuild from primitives), assemble one
section per `use_figma` call, and screenshot after each section lands.
