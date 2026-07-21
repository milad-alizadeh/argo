---
paths:
  - "{{COMPONENTS_GLOB}}"
---

# UI Component Rules

Applies to all UI components under `{{COMPONENTS_DIR}}`. Read together with the
`design-system` rule (tokens + utilities, no magic numbers).

## Atomic design — always (atoms → molecules → organisms)

Every piece of UI is one of three tiers. This vocabulary is what stops rogue,
one-off styling from creeping in. Before writing markup, decide which tier the unit
belongs to and build/reuse at that tier.

- **Atoms** — the smallest indivisible presentational units: a button, input, label,
  icon, badge, dot, divider, spinner, meter bar. Atoms live in `shared/components/ui/`
  (`Button.tsx`, `StatusDot.tsx`), icons in `shared/components/ui/icons/`. They take only
  presentational props, hold no domain logic, and never emit raw `<svg>`.
- **Molecules** — a small reusable composition of atoms forming one labelled unit: a
  setting row, a status banner, a card header, an empty-state block, a pill. Molecules
  live in `shared/components/ui/` when reused across two+ regions; otherwise as a
  subcomponent under the owning region's `components/` folder.
- **Organisms** — a self-contained domain section composed of molecules and atoms: a
  card, a list, a settings panel, a detail view. Organisms live in their region's folder
  (`domains/<region>/components/`) and are where domain logic / state wiring is allowed.

Rules that fall out of this:

- **Never inline a lower-tier shape.** Writing the markup for an atom or molecule
  inside an organism is a duplication bug, even on first use — import it, or extract
  it if it doesn't exist yet.
- **Build bottom-up.** A new organism is assembled from existing atoms/molecules. If
  a needed primitive is missing, create it in `shared/components/ui/` first, then compose.
- **One tier per file:** an atom file exports one atom, a molecule file one molecule.

## Reuse before you build

- **Before writing any raw markup, search `shared/components/ui/` (and the owning region's
  folder) for a component that already renders it.** If one exists, import it — never
  re-implement its markup at a call site.
- **The moment the same shape would appear a second time, extract it** into one
  component. Two copies is the trigger — don't wait for a third.
- **Don't introduce a bespoke element where a primitive is the right tool** (sliders,
  selects, dialogs, radio groups, meters, dividers, section labels, icons). Raw
  buttons/inputs standing in for an existing primitive are forbidden.
- **Reach for your configured component kit before authoring a primitive.**
  {{COMPONENT_KIT}} A hand-rolled equivalent of a kit primitive is a duplication bug, not a
  design choice. When the kit's variants don't match the design, **adapt the vendored
  component's variant map to the design tokens**; writing a parallel component beside it
  is what the rule forbids. Vendored primitives keep their upstream filenames, and any
  icon a generated component pulls in is swapped for this project's icon atom.
- Re-export every primitive from `shared/components/ui/index.ts` so imports are one line.
- Primitives are pure presentation — no state machines, no I/O, no hooks beyond local
  interaction state. Interactive primitives wrap the chosen headless-UI library and
  are styled only with design-system tokens; never import the library's default CSS.

## All rendered text goes through one `Text` atom

Typography is a primitive like any other, so it obeys the rule above: the project's
type-role ladder (`design-system.md`, "Roles, not values") is applied by **one atom**,
`shared/components/ui/Text.tsx`, exposing the roles as a `variant` prop. The rule is not merely
"don't type a role class" — it is that **every string the user reads is rendered by
`Text`**. A bare string in a `div` is the violation even when it inherits the right type
today, because inheritance is exactly what drifts the moment an ancestor changes. If this
project has no `Text` atom yet, creating it is the first step of the next UI change that
would otherwise write one.

```tsx
<span className="text-meta text-faint">14:32</span>       // forbidden
<div>No items yet</div>                                   // forbidden
<Text variant="meta" className="text-faint">14:32</Text>  // correct
```

That covers labels, counts, captions, values, empty-state copy, and the text inside any
stories/examples — the specimen should model the rule it teaches. Where a wrapper element
exists only to carry text, collapse it into the `Text` via `as` rather than nesting a
`Text` inside a redundant `span`.

- **`Text.tsx` is the only file that spells a role class.** Its variant map is the
  single lookup; a primitive that styles its own root and genuinely cannot wrap its
  children (a button whose `asChild`/`as` hands them to a slot) composes the class from
  that map rather than re-typing it.
- **Colour is not part of a type role**, so `Text` takes no `tone`/`color` prop. A
  caller passes the colour utility through `className`; the project's class-merge helper
  must be taught the role names so it de-dupes role against role without eating the
  colour class sitting beside it.
- **The element is the call site's decision, not the role's.** `Text` renders a neutral
  inline element by default and takes an `as` prop for the rest — never pick `h1`
  because a role looks big; pick the heading level the document outline needs.
- If/when this project adds Storybook, `Text`'s gallery story is the **type specimen** —
  every role in one frame, and the visual-diff surface for any change to the role tuples.

## Build from the inventory — when a design study exists

If the UI being built comes from a settled design study, its component inventory
(`docs/designs/<study>.inventory.md`, produced by the `componentize-design` skill) is the
build contract:

- **Names are fixed by the inventory.** The component's name, tier, and props come
  from its inventory row — don't rename, re-tier, or re-shape mid-build.
- **A component that isn't in the inventory doesn't get built** off a study;
  update the inventory first (one row), then build. This keeps the study, the
  inventory, and the codebase telling one story.
- Never derive a component by copying study markup — rebuild from tokens and
  existing primitives (the study is a spec, per `design-studies.md`).

## Icons — one icon component per file

**No inline SVGs anywhere.** Every SVG icon is its own named component in
`shared/components/ui/icons/`, re-exported from its barrel. Each file exports exactly one
component, accepts optional `width`/`height`/`className`, and defaults to its original
size. Plain-text glyphs standing in for icons (`✕`, `→`) are forbidden — use the icon
atom.

If the project's component kit is a code generator, its icon setting only chooses which
import the generator *writes*, and it may not know this project's icon library at all —
so a vendored component that ships an icon arrives importing the wrong one. **Swap it for
the matching atom in the same change**, and never let the generator's icon package into
`package.json`: its presence there means a swap was missed.

## Screens — container/View split

Every screen is two files: a thin **container** (`CheckoutScreen.tsx` — hooks, data
fetching, store wiring; ~10 lines) and a pure presentational **View**
(`CheckoutScreenView.tsx` — props in, JSX out).

- **The View never imports data access.** No API client, no data bridge, no store
  hooks — it receives everything through props. All wiring lives in the container,
  which does nothing but wire and render `<XView {...props} />`.
- Fixtures are typed off the container's own view-model types and live next to the
  screen — shape drift is a compile error, never a silent stale fixture.

> If/when this project adds Storybook: render the View with typed fixtures, never the
> container, and story **prop axes, not values**. Re-running the same render with a
> different number or word is a control, not a story — a `percentage` prop gets one
> story plus a range control, not `Empty` / `Low` / `Half` / `Full`. A discrete union
> gets one story with a `select` control plus a single gallery story showing every
> value side by side. A boolean gets one story for its non-default side. Structural
> states (loading / empty / error / populated) are genuinely different renders, so
> those do get a story each. Behavioural edges (clamping, rounding, truncation) belong
> in a `play` assertion or a unit test, never in their own story. An empty required
> value (`label: ''`) is not a variation but invalid input — fix it with a type or a
> boundary guard, not a story that renders nothing.
>
> A parent stories only what it *adds*. Tiers compose, so their props do too: a parent
> that re-stories a prop it forwards untouched multiplies one axis by the depth of the
> tree. If a parent story differs from its base story only by a pass-through prop, it
> belongs to the child — delete it. The parent's own stories are the ones composition
> creates: which child renders and the switch between them, focus/keyboard/aria wiring
> spanning two children, layout under pressure, its own state. A child's union is covered
> by the child's gallery and a pure helper's edges by its unit test — neither needs a
> second telling upstairs.
>
> A story's `title` top segment equals its top domain folder — the taxonomy is derived
> from where the file lives, never chosen. Components live under `domains/<region>/` (each
> region owns its `components/`) or `shared/components/ui/` (framework primitives, shared
> across regions). A primitive in `shared/components/ui/Button` titles as `Shared/Button`;
> a component in `domains/<region>/components/Row` titles as `<Region>/Row`. Placement is
> `dirname`, so the sidebar reads as one per-domain catalog and never drifts between
> sessions or worktrees.
>
> Within a domain, single-owner parts still nest under their owner: a component with exactly
> one importer nests beneath it (`<Region>/List`, then `<Region>/List/Row`) rather than
> standing beside it as a peer — sibling entries for one organism's parts claim components
> exist where one does. Only the title changes, never the file or the export name. A part
> imported by a second region is promoted to `shared/`, and that move is the promotion.
>
> The story file is also the component's docs page: turn autodocs on globally, document
> each prop with a TSDoc comment on the component's props type (react-docgen lifts those
> into the props table — don't duplicate them into `argTypes`, with the one exception
> below), declare the control wherever inference is wrong (`select` + `options` for a
> union, `range` + `min`/`max` for a bounded number, `boolean` for a flag), and wire every
> callback to `fn()` so it lands in the Actions panel and can be asserted from `play`.
>
> The prose on that page comes from docblocks. The exported component's own docblock opens
> it — first line a one-sentence summary of what the unit is for, any detail after a blank
> line — and every exported story takes one too, which renders as the caption under that
> story's heading. `meta` may carry a docblock of its own, seeding the page header, and
> `parameters.docs.description.component` overrides it. All of these are `/** */`; a `//`
> in those positions is dropped on the floor (see `comments.md`).
>
> Two things react-docgen cannot see. A prop whose type is inferred from a variant-map
> factory (rather than declared as a named type) resolves to neither a type nor a
> description, so its row renders blank unless the story spells it out:
>
> ```tsx
> argTypes: {
>   variant: {
>     control: 'select',
>     options: ['neutral', 'accent', 'danger'],
>     description: 'Which token family the control spends.',
>     table: { type: { summary: 'Variant' }, defaultValue: { summary: 'neutral' } },
>   },
> }
> ```
>
> And a component produced by a factory rather than declared directly has no docgen surface
> at all, so its description has to arrive as `parameters.docs.description.component` on
> its `meta`. Every docblock is rendered as markdown, so backtick angle-bracketed names,
> paths and identifiers — a bare `<Name>` is parsed as a tag and vanishes from the page.
> Stories prove composition and visual state only — they never replace e2e wiring checks.
