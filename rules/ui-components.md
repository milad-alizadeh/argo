---
paths:
  - "apps/desktop/src/renderer/src/components/**/*.{ts,tsx}"
---

# UI Component Rules

Applies to all UI components under `apps/desktop/src/renderer/src/components/`. Read
together with the `design-system` rule (tokens + utilities, no magic numbers).

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
- **Reach for your configured component kit before authoring a primitive.** This is a
  configured shadcn project (`apps/desktop/components.json`, `radix-ui` +
  `class-variance-authority` already installed) — `bunx shadcn@latest add <name>` is where
  a badge, progress bar, dialog or select comes from. A hand-rolled equivalent of a kit
  primitive is a duplication bug, not a design choice. When the kit's variants don't match
  the design, **adapt the vendored component's `cva` variant map to our tokens** — owning
  the vendored file is the intended workflow; writing a parallel component beside it is not.
  Vendored primitives keep their upstream lowercase filenames (`button.tsx`,
  `badge.tsx`) and, since `components.json` still declares lucide, any icon a generated
  component pulls in is swapped for the Phosphor icon atom.
- Re-export every primitive from `shared/components/ui/index.ts` so imports are one line.
- Primitives are pure presentation — no state machines, no I/O, no hooks beyond local
  interaction state. Interactive primitives wrap `radix-ui` (the headless-UI library)
  and are styled only with design-system tokens; never import the library's default CSS.

## All rendered text is a `Text`

Typography is a primitive like any other, so it obeys the rule above: the type-role
ladder is applied by **one atom**, `shared/components/ui/Text.tsx`. The rule is not merely
"don't type a role class" — it is that **every string the user reads is rendered by
`Text`**. A bare string in a `div` is the violation even when it inherits the right type
today, because inheritance is exactly what drifts the moment an ancestor changes.

```tsx
<span className="text-meta text-foreground-faint">14:32</span>       // forbidden
<div>No sessions yet</div>                                          // forbidden
<Text variant="meta" className="text-foreground-faint">14:32</Text>  // correct
```

That covers labels, counts, captions, values, empty-state copy, and the text inside
stories — a gallery story's captions included, since the specimen should model the rule
it teaches. Where a wrapper element exists only to carry text, collapse it into the
`Text` via `as` rather than nesting a `Text` inside a redundant `span`.

- **`Text.tsx` is the only file that spells a `text-<role>` class.** Its variant map is
  the single lookup; a primitive that styles its own root and genuinely cannot wrap its
  children (`Button`, whose `asChild` hands them to a Slot) composes the class from that
  map rather than re-typing it.
- **Colour is not part of a type role**, so `Text` has no `tone` prop. A caller passes
  `text-foreground-faint` / `text-tone-run` through `className`; `cn()` is taught
  the role names so it de-dupes role against role without eating the colour class.
- **The element is the call site's decision, not the role's.** `Text` renders a neutral
  `span` by default and takes an `as` prop for the rest — never pick `h1` because a role
  looks big; pick the heading level the document outline needs.
- `Text`'s gallery story is the project's **type specimen** — every role in one frame,
  and the visual-diff surface for any change to the role tuples.

## Build from the inventory — when a design study exists

If the UI being built comes from a settled design study, its component inventory
(`docs/designs/<study>.inventory.md`, produced by `/componentize-design`) is the
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

The shadcn CLI can only generate `lucide` or `radix` icon imports — `components.json`
cannot be pointed at Phosphor, and setting it there would be accepted and then ignored.
So a vendored kit component that ships an icon (`select`, `checkbox`, `dialog`,
`accordion`, `dropdown-menu`, `calendar`) arrives with a lucide import: **swap it for the
matching atom in `shared/components/ui/icons/` in the same change.** `lucide-react` is never
added as a dependency — its presence in `package.json` means a swap was missed.

## Screens — container/View split

Every screen is two files: a thin **container** (`CheckoutScreen.tsx` — hooks, data
fetching, store wiring; ~10 lines) and a pure presentational **View**
(`CheckoutScreenView.tsx` — props in, JSX out).

- **The View never imports data access.** No API client, no IPC bridge, no store
  hooks — it receives everything through props. All wiring lives in the container,
  which does nothing but wire and render `<XView {...props} />`.
- Fixtures are typed off the container's own view-model types and live next to the
  screen — shape drift is a compile error, never a silent stale fixture.

## Storybook stories

When Storybook is installed, it's mandatory: every component and every screen **View**
ships a colocated `*.stories.tsx` in the same change. Containers are exempt — story the
View, with typed fixtures (never the container).

**A story is a prop axis, not a value.** The unit of a story is a distinct rendering
*behaviour*. Re-running the same render with a different number or word is a **control**,
not a story: a gauge with a `percentage` prop gets one story and a range control the
reviewer can drag — never `Empty` / `Low` / `Half` / `Nearly` / `Full`.

Pick the shape from what the prop is:

| Prop | Story shape |
|---|---|
| Continuous (number, free text) | ONE story + an `argTypes` control (`range`, `text`) |
| Discrete union (tone, status, variant) | ONE story + a `select` control, **plus** one gallery story rendering every value side by side |
| Boolean that changes the render | one story for the non-default side only — the default side is the base story |
| Structural (loading / empty / error / populated) | one story each; these are different renders, not different values |

- **Every prop is still covered** — coverage moved into `argTypes` and the gallery, not
  out of existence. A prop with neither a story nor a control is a gap.
- Edges that are *behaviour* rather than appearance (clamping, rounding, truncation)
  belong in a `play` assertion on the base story or a unit test — never in their own story.
- **An empty required value is not a variation, it's invalid input.** A story that renders
  nothing (`label: ''`, `text: ''`) proves nothing — the fix is a type or a guard at the
  boundary, not a story. Only story emptiness where empty is a real, designed state
  (an empty list, a zero count).
- A gallery story is also the visual-diff surface: one screenshot covers the whole union.
- Stories prove visual state only — they never replace the container's e2e wiring checks.

### A parent stories only what it adds

Tiers compose, so their props do too — and a parent that re-stories the props it merely
forwards multiplies one axis by the depth of the tree. A four-tier console reached 26
stories that way, telling `live` vs `capture` at every tier and the agent sparkle at three.

**If a parent story differs from the base story only by a prop the parent passes through
untouched, it belongs to the child — delete it.** What the parent stories is what
composition creates and nothing below it can show:

- which child renders, and the switch between them
- focus, keyboard and `aria-controls` wiring that spans two children
- layout under pressure — a long label has to give way somewhere
- the parent's own state (`expanded`)

A child's union is covered by the child's gallery; a pure helper's edges are covered by
its unit test. Neither needs a second telling upstairs. Cover one axis at two tiers and
both copies rot the day the child changes — the upstairs copy just fails later and
further from the cause.

### Title follows the domain folder

A story's `title` top segment equals its top domain folder — derived from where the file
lives, never chosen, so the sidebar reads as one per-domain catalog and never drifts
between sessions or worktrees.

- **Domain folders** are the CONTEXT.md Panes/regions: `rail`, `activity`, `ship`,
  `preview`, `console`, `screen` (the Actor-screen shell) and `voice` (later). A component
  in `domains/rail/components/SessionRow` titles as `Rail/SessionRow`.
- **Shared primitives** live in `shared/components/ui/`, titled under `Shared/` —
  `shared/components/ui/Button` → `Shared/Button`. There is no `UI/`-vs-`Cockpit/` split: a
  vendored kit atom and a hand-rolled primitive share one `Shared/` namespace.

Within a domain, single-owner parts still nest under their owner: a component with exactly
one importer is that organism's part, not its peer — `Console/ChannelTabs`, then
`Console/ChannelTabs/ChannelTab`, `Console/ChannelTabs/Channel`. Sibling entries for one
organism's parts claim components exist where one does. Only the title changes — never the
file or the export name. A part imported by a second region is promoted to `shared/`, and
that move *is* the promotion.

### The story file is also the docs page

Autodocs are on globally (`tags: ['autodocs']` in `.storybook/preview.tsx`), so whatever a
story declares is what the generated page shows. Declare it properly:

- **Document props on the component, not in the story.** A TSDoc comment on each prop in
  the component's props type is what react-docgen lifts into the docs table — write it
  there once rather than duplicating it into `argTypes[prop].description`. The one
  exception is a prop react-docgen cannot see, below.
- **The component's own docblock opens the page.** Its first line is a one-sentence
  summary of what the unit is for — that sentence is what the docs page leads with — and
  any detail follows after a blank line. `meta` may carry a docblock of its own, which
  seeds the page header; `parameters.docs.description.component` overrides both.
- **Every exported story takes a docblock**, which renders as the caption under that
  story's heading. The house habit of saying WHY a story exists is exactly what belongs
  there, now addressed to a reader of the docs page rather than the next editor.
  All three are `/** */` — a `//` is dropped on the floor (see `comments.md`).
- **A `cva` / `VariantProps` prop is invisible to react-docgen.** It resolves to neither a
  type nor a description, so the row renders blank and has to be spelled out in `argTypes`:

  ```tsx
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'ghost', 'review-secondary', 'verdict-changes', 'verdict-approve'],
      description: 'Which token the control spends — never the state its caller is in.',
      table: { type: { summary: 'ButtonVariant' }, defaultValue: { summary: 'ghost' } },
    },
  }
  ```

- **A component built by a factory has no docgen surface at all.** react-docgen cannot see
  through `createIcon(...)`, so every icon atom's description arrives as
  `parameters.docs.description.component` on its `meta`.
- **Every docblock is rendered as markdown**, so a component name written bare —
  `wrapping the children in <Text>` — is parsed as a tag and silently vanishes from the
  page. Backtick every angle-bracketed name, every path, and every identifier.
- **Declare the control wherever inference is wrong or lossy:** `select` (with `options`)
  for a union that arrives as a plain string, `range` (with `min`/`max`/`step`) for a
  bounded number, `boolean` for a flag, `text` for free copy. A prop with ten legal values
  rendering as a free-text box is a bug in the story, not a Storybook limitation.
- **Wire every callback to `fn()`** from `storybook/test` in `meta.args`, so it lands in the
  Actions panel and can be asserted from `play`. An unspied handler is both invisible and
  untestable.
- Omit a prop from `argTypes` only when the inferred control is already the right one.
