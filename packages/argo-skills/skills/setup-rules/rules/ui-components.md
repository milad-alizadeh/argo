---
paths:
  - "{{COMPONENTS_GLOB}}"
---

# UI Component Rules

Applies to all UI components under `{{COMPONENTS_DIR}}`. Read with `design-system.md`.

**This file is written in one UI dialect (DOM elements, `className`) and that is its
spelling, not its rules.** On another stack rewrite it the way `setup-rules` §3 writes a
binding: keep the intents, re-spell every mechanism, and never replace a mechanism with a
claim that the old dialect is absent (grep this file's own `paths:` first; `setup-rules` §5a).
The intents: every unit is placed in a tier before it is written and reused at that tier; an
existing primitive is never re-implemented inline; every string the user reads goes through
one text atom; a screen separates the part that decides from the part that renders.

## Three tiers, decided before the markup is written

- **Atoms**: the smallest presentational units (button, input, label, icon, badge, dot). They
  take only presentational props, hold no domain logic, and never emit raw `<svg>`.
- **Molecules**: a small composition of atoms forming one labelled unit (a setting row, a
  status banner, an empty-state block).
- **Organisms**: a self-contained domain section (a card, a list, a settings panel), and the
  only tier where domain logic and state wiring are allowed.

Atoms and shared molecules live in `shared/components/ui/`; an organism and its own parts in
their region's folder. Never inline a lower-tier shape inside a higher one, even on first use.
One tier per file.

## Reuse before you build

- Before writing any markup, search for a component that already renders it.
- The moment the same shape would appear a second time, extract it. Two copies is the trigger.
- Never a bespoke element where a primitive is the right tool (a select, a dialog, a slider).
  {{COMPONENT_KIT}} When the kit's variants don't match the design, adapt the vendored
  component's variant map to the tokens; a parallel component beside it is what the rule
  forbids. Vendored primitives keep their upstream filenames, and an icon a generated
  component pulls in is swapped for this project's icon atom in the same change.
- Primitives are pure presentation: no I/O, no state beyond local interaction state, styled
  only with tokens, never the headless library's default CSS.

## All rendered text goes through one `Text` atom

The type-role ladder (`design-system.md`) is applied by one atom, `Text`, exposing the roles
as a `variant` prop. **Every string the user reads is rendered by `Text`.** A bare string in
a `div` is the violation even when it inherits the right type today, because inheritance is
what drifts when an ancestor changes.

```tsx
<span className="text-meta text-faint">14:32</span>       // forbidden
<Text variant="meta" className="text-faint">14:32</Text>  // correct
```

- `Text` is the only file that spells a role class. A primitive that cannot wrap its
  children composes the class from `Text`'s variant map rather than re-typing it.
- Colour is not part of a type role: it is passed through `className` beside the variant.
- The element is the call site's decision (`as` prop), never the role's: pick the heading
  level the document outline needs, not the one that looks big.

## Icons

Every icon is its own named component in `shared/components/ui/icons/`, one per file, taking
optional `width`/`height`/`className`. No inline SVG, no text glyph (`✕`, `→`) standing in
for an icon. A generator's icon package never enters `package.json`.

## Screens: container / View

A thin **container** (hooks, data fetching, store wiring) renders a pure **View** (props in,
JSX out). The View imports no API client, bridge or store hook; fixtures are typed off the
container's own view-model types and live next to the screen. This binds new screens and the
next substantial edit to an existing one, not a sweep; whoever installs it states how many
screens don't conform today.

## Build from the inventory, when a design study exists

A settled study's component inventory (`docs/designs/<study>.inventory.md`) is the build
contract: names, tiers and props come from its rows, a component not in it is not built off
the study until a row is added, and nothing is derived by copying study markup (`designs.md`).

## Coverage: a state with no render is a state nobody has looked at

Where the project renders states for review (Storybook or its equivalent), render the View
with typed fixtures, never the container, and **render axes, not values**:

| Prop | Shape |
|---|---|
| Continuous (a count, free text) | one render at a representative value, plus a control |
| Discrete union (tone, status) | one gallery rendering every value side by side |
| Boolean that changes the layout | the non-default side only |
| Structural (loading / empty / error / populated) | one each |

Behavioural edges (clamping, truncation) belong in a unit test. An empty required value is
invalid input, not a variation. **A parent covers only what it adds:** a case that differs
from the base only by a prop the parent forwards untouched belongs to the child. A screen
whose regions each own a state matrix gets one representative composed case plus its own
structural variants, never one case per lifecycle state. Name a case for what a human sees,
never an internal matrix id.

Placement derives the catalogue: a component's title is its top domain folder, a part with
exactly one importer nests under its owner, and a part imported by a second region is
promoted to `shared/`, which is the promotion.
