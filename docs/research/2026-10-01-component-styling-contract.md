# Proposed desktop component styling contract

2026-10-01. This is the proposed implementation contract from the [component audit](2026-10-01-component-system-audit.md).
It is not active policy yet. Existing `AGENTS.md`, `docs/design-stack.md`, tests, and gates remain unchanged.
The implementation must adopt this contract and change conflicting instructions in the same change.
The [catalog](2026-10-01-component-catalog.md) gives each app source a disposition.
The [registry audit](2026-10-01-shadcn-component-provenance.md) gives each installed primitive a disposition.

A primitive provides reusable structure or interaction.
A recipe supplies styles for a named treatment.
A pattern composes primitives, recipes, and content.
An adapter connects an external library to the app contract.
A fork is a copied implementation with approved local changes.

## Choose the owner before editing

1. Find the affected component in the catalog.
2. Find a matching installed shadcn primitive and inspect its public slots, variants, and interaction.
3. Choose one of the cases below.
4. Put the change in that owner and supply the required proof.
5. If the case does not fit, request a decision before adding a new styling mechanism.

| Case | Owner | Allowed change | Required proof |
| --- | --- | --- | --- |
| Same meaning, different theme color | Theme CSS | Change the existing role values for both appearances | Actual foreground/background and state contrast |
| Placement in one screen | That layout | Width constraint, margin, grid/flex tracks, alignment, overflow placement | Narrow/wide layout and long content |
| Existing shadcn treatment fits | Direct registry component | Use its public variant, size, slots, and interaction props | Visible behavior and accessible names |
| Repeated app appearance | Named app recipe and adaptation | Explicit slot classes and finite visual variants | Default and adapted browser contracts |
| Repeated structure/content contract | App pattern | Compose the existing primitives and named recipes | Interaction, content states, and Light/Dark |
| Domain state means a tone | Domain presentation mapping | Map the closed state set to a shared treatment | Every state and non-color indication |
| Library-owned DOM or canvas | Library adapter | Scoped DOM rules or resolved theme snapshot | Theme changes and real library rendering |
| Primitive structure cannot express the required pattern | Approved app composition or fork | Implement outside registry space | Recorded rationale, baseline, API, and regression proof |

Themes change color assignments. They do not change typography, spacing, density, or geometry.
The first implementation uses one selected shadcn style as the default measurement baseline.
Custom app components match that baseline unless the catalog names a required adaptation.

## S01 Registry source

Keep generated shadcn source under `platform/renderer/components/ui/`.
Record the selected style, CLI version, payload hashes, and expected generation transforms.
Use the CLI output for the selected configuration as the identity baseline, not authored upstream style placeholders.
Keep that source unchanged between reviewed upstream updates.
Place app variants, app imports, app text roles, and product recipes outside this directory.

Use direct imports when defaults fit. A component does not need an app wrapper merely because it comes from shadcn.
Keep registry helpers at the target paths that their dependency metadata specifies.
Move app-owned DropdownTrigger and its story out of `ui/`.

The [official shadcn model](https://ui.shadcn.com/docs) permits direct edits.
This source boundary is Argo's stricter maintenance policy.
An agent cannot relax it because a requested override is inconvenient.
Apply S19 when public composition cannot satisfy a requirement.

## S02 Theme values

Author color values in `platform/renderer/styles/themes/<theme>.css`.
Each theme supplies the same complete role set in Light and Dark.
Put Tailwind bindings in `platform/renderer/styles/theme-bindings.css`.
Keep all Tailwind base palette shades and default numeric scales available.
Select Tailwind shades in theme assignments, not at repeated product call sites.

Keep canonical shadcn names such as `background`, `card`, `popover`, `primary`, `muted`, `destructive`, `border`, and `ring`.
Add a role only when the existing role cannot express a current meaning.
Do not add a parallel `app-background`, `argo-destructive`, or component-specific copy of a shared color.
The [official theming contract](https://ui.shadcn.com/docs/theming) supplies bindings without component edits.

Treat `destructive` as the existing shadcn action/error emphasis role.
Preserve its native component treatment, including tint ratios and focus states.
For new filled warning/success/info treatments, use a surface and its paired `-foreground`.
Add `-border` only for a treatment that draws that border.
Add `-indicator` only when an independent status mark needs ink on a different ground.
Do not use a pale surface token as text or a dot merely because its name sounds correct.

The theme coordinator applies identity and resolved appearance on `html`, before visible paint.
React components select semantic variants, not Light/Dark palettes.
Runtime measurements and user-data colors follow S14 and S17, rather than this value registry.

## S03 Direct usage and caller layout

Select an existing `variant` or `size` before changing a control's measurements.
Keep margins, maximum content widths, pane placement, and responsive visibility with the caller.
Keep popup width and maximum scrolling height with the popup composition.
For a stretched form control, use its supported full-width layout without changing its text size or padding.

Place repeated typography, control padding, height, icon size, radius, border treatment, and interactive colors in a named adaptation.
Caller `className` is not a second variant API.
If two callers correct the same default, move that correction into the existing app owner.
Simple equal layout strings do not require a reusable component.

Examples: Dialog `sm:max-w-md` is local layout.
Button `size="icon-sm"` is a native size selection.
Button `size="icon" className="size-7"` is a competing size request.
Move that request to the matching native variant or a cataloged adaptation.

## S04 Recipes and adaptations

Store cross-domain app adaptations under `platform/renderer/components/design-system/`.
Keep domain-only recipes beside their domain pattern.
Use a static lookup for one visual axis.
Use the existing CVA dependency when interacting axes need compound variants.
Keep every Tailwind class literal statically discoverable.

Use one shared tone recipe source at `platform/renderer/components/design-system/tone-recipes.ts`.
Separate filled, subtle, and indicator treatments when they serve different current uses.
Do not create every possible treatment in advance.
Expose explicit slot recipes where a primitive styles its own descendants.
Merge recipes through the configured app `cn` utility.

An adaptation changes presentation, not interaction or domain state.
Preserve the primitive's ref, attributes, controlled state, and event semantics.
Forward `render` only when the adaptation supports its element and accessibility contract.
Use direct composition when narrowing that API is intentional.
Give display-only StatusBadge and interactive Ticket/Skill triggers separate APIs.

## S05 Patterns and reuse

Keep domain patterns in their domain renderer facet.
Promote a pattern to platform only when actual cross-domain consumers establish the same contract.
The catalog identifies current shared candidates, rather than an imagined wrapper for every export.

Create these shared app patterns from the audited use cases:

- EmptyState: Compose registry Empty slots and one approved title/description/media/action recipe.
- Notice: Compose registry Alert slots and finite tone treatments.
- DropdownTrigger: Move the existing searchable/menu trigger composition out of registry space.
- SearchField: Own the existing inline search treatment outside registry InputGroup and Command.
- RangeField: Compose registry Slider and Input for the repeated effort/threshold controls.

Keep ContractFailureAlert as the existing error-content specialization.
Keep PermissionPrompt, CodeBlock, Terminal, PageHeading, SectionTitle, Icon, and Loader in their existing app owners.
Keep ComposerAttachmentChip, InspectorHeader, ChoiceCard, rich menu options, and row patterns within their proven owners.
A complete pane layout is an app layout pattern, not another Card around a section.

Use shadcn for attachment slots, disclosure, popup behavior, controls, and selection where the available shape fits.
Keep Markdown, ANSI, Shiki, CodeMirror, Lexical, Mermaid, and virtualization as specialized adapters.
Shadcn does not replace those engines.

## S06 State and nonvisual modules

Keep queries, providers, editor plugins, routing, and state mapping free of presentation mechanisms.
A TSX suffix does not make a state provider a visual component.
Keep screens as state assembly plus layout and pattern composition.
Keep story scaffolding outside production source.
Treat `composer-story-samples.tsx` as verification code despite its suffix.

## S07 Typography

Preserve Tailwind `text-xs`, `text-sm`, `text-base`, and their default companion metrics.
Preserve registry typography classes and sizes.
Treat direct registry text as a valid typography contract.
Do not attach an app text role to every registry slot or every nested string.

Use ordinary `--typography-*` metadata and complete app recipes for custom text.
Each recipe defines size, line height, weight, and tracking.
Use one recipe for each title/detail relationship, including the adapted Empty and custom EmptyState.
Allow deliberate inheritance from the owning recipe.
Keep UI labels, reading prose, code content, and brand marks as separate actual needs.

Name emphasis within the recipe when the existing role already owns weight.
Remove undefined `type-caption` uses and duplicate-specificity typography selectors.
Keep code-font input treatment explicit without remapping registry size utilities.
Match a custom component to the selected shadcn baseline before introducing a different scale.

## S08 Cascade and merging

Use the one configured `cn` helper for app class conflicts.
Make recipes replace the intended size, line height, weight, and tracking groups together.
Make sure that both the merger output and browser computed styles satisfy the contract.
Class merging alone cannot settle CSS specificity or cascade layers.

Keep inherited app defaults in an appropriate base layer.
Keep app overrides scoped to their named pattern or adapter.
Replace global tag/role/data-slot rules that silently restyle registry controls.
Remove `.type-body.type-body` and equivalent specificity tricks.
Treat new important classes as a design-boundary failure requiring review, not a routine override method.
Preserve important classes supplied by the registry baseline.

## S09 Interaction states

Reuse primitive keyboard, focus, disabled, invalid, selected, and expanded behavior.
Include all affected states when a recipe changes interactive appearance.
Keep one visible keyboard-focus treatment for each control.
A recipe that suppresses a ring must provide an approved replacement in the same owner.
Do not suppress input rings globally.

Use registry Checkbox, RadioGroup, Slider, and Input for custom choice/range controls when their behavior fits.
Keep app choice-card structure outside those primitive files.
Keep measured scrolling controls separate from decorative text.
Provide accessible names independently of tooltips.
Keep nested actions and full-row focus contracts intact.

## S10 Slots, portals, and rendered elements

Apply changes to the public slot that owns the visual property.
Root classes do not automatically replace a descendant's text or focus treatment.
Prefer explicit root/title/description/media/action recipes to broad descendant selectors.

Base UI `render` is element composition, not permission to drop primitive props.
Preserve refs, event merging, aria attributes, focusability, and disabled semantics.
Render an actual button for actions and an anchor for navigation.
Do not nest interactive elements.

Scope theme selection to `html` so body portals receive the same values.
Own popup positioning and measured bounds in the popup adapter.
Test nested popups, focus return, Escape, long text, and narrow viewports for affected compositions.

## S11 Library adapters

Keep library-owned DOM rules in the named editor, terminal, diagram, or scrollbar adapter.
Scope those selectors to an app owner rather than all vendor slots.
Use theme role references when the library supports CSS variables.
Resolve actual colors when it requires numeric or serialized values.

Cache resolved values by theme identity and resolved appearance.
Invalidate on a custom theme change even when the Light/Dark appearance does not change.
Use one syntax role source for CodeMirror and Shiki.
Use a terminal palette for ANSI meanings instead of renaming ANSI colors to product success/error.
Use the same inline reference recipe in React content and Lexical-created DOM.

## S12 Panes, surfaces, and clipping

Use the existing panel layout owner for the repeated frame/header/body/divider contract.
Make AppShell and WorkspaceShell consume that contract.
Follow [ADR-0038](../adr/0038-the-desktop-cockpit-is-opaque.md) for ground, edges, and shadows.
Keep runtime sizes and split state with the layout owner.

| Region | Ground | Edge | Shadow | Clipping owner |
| --- | --- | --- | --- | --- |
| Window and full-width chrome band | `background` | Chrome foot only | None | Window/layout |
| Sidebar and roster | `card` or its canonical `sidebar` binding | One trailing structural edge | None | Sidebar pane body |
| Feed/deck plane | `background` | None unless structural | None | Content pane body |
| Raised row/rail/dock | `muted` | Only structural edge | None | That row or rail |
| Composer and anchored controls | `card` | One hairline | None | Composer body, not its popup |
| Menu, popover, dialog, dropdown | `popover` | One hairline | Approved overlay shadow | Popup content |

Keep one edge at each meeting boundary. The parent split owns that decision.
Put outer radii and `overflow: hidden` on the pane body.
Keep header height, shared insets, and square internal corners in the panel recipe.
Keep popup portals outside that clipping boundary.
Keep scroll behavior with the actual scroll viewport.
Keep resize handles reachable even when the visual border is narrow.

Use registry Resizable for split interaction.
Use native scrolling when it satisfies the pane contract.
Use registry ScrollArea only when its custom scroll behavior is required.
Scope customized ScrollArea slots to an app ScrollViewport adapter.
Use no Card wrapper solely to obtain a pane background, border, or clipped corner.

Remove anchored `panel-elevation`, composer shadows, property-pill shadows, blur, and translucent composer ground.
A different surface model needs an ADR change before implementation.
A media scrim is a documented overlay treatment under S14, not a license for translucent pane surfaces.
See the [pane examples](2026-10-01-pane-styling-examples.md) for concrete ownership and clipping cases.

## S13 Icons and geometry

Keep original generated icons in registry source.
Use app Icon roles within app patterns and controls.
Own the app default size in Icon itself, with explicit inheritance where the primitive controls icon dimensions.
Remove unlayered global `[data-slot="icon"]` dimensions.

Keep control icons, inline text icons, metadata marks, language assets, and tree glyphs distinct.
Use a matching native size before adding a local size recipe.
Equal pixel values alone do not prove a shared semantic role.
Store component-specific geometry beside its owner.
Keep loader shape dimensions local and accessible loading state explicit.
Use `currentColor` when Loader exposes a text-color override.

## S14 External colors and identity assets

Keep provider label color as validated content data, not one new global token per label.
The Ticket boundary already accepts six hex digits or null.
Apply that value through the single TicketLabel adapter and a scoped variable.
Use a contrast-safe text fallback when a tint cannot satisfy the actual ground.
Test extremes and missing colors in both appearances.

Keep approved provider/Harness/language assets in their identity adapters.
Keep brand colors outside general action/status recipes.
Apply inversion or separate Light/Dark assets only after checking that particular asset.
Give the media scrim a named shared value that can remain black in both appearances.
Mask black/transparent values encode alpha geometry, not visible palette choices.
Record such exceptions in the owner contract rather than replacing them with foreground tokens.

## S15 Upstream updates

Inspect the latest selected registry items in a scratch candidate tree first.
Review CLI and dependency updates independently from mutable hosted payload updates.
Compare transformed source against the recorded installed baseline.
Replace only identified registry files after their app behavior moves to the named owner.
Keep a new payload/hash record with each approved update.

Run the focused component browser contracts after the update.
Run app pattern interactions, Light/Dark accessibility, and the accepted Electron theme flow.
Do not treat an empty CLI diff as proof that global CSS preserves default sizes.
Use no blanket overwrite as a discovery step.
The [CLI](https://ui.shadcn.com/docs/cli) supplies preview and comparison, not an automatic three-way merge of local customizations.

## S16 Status, motion, and meters

Map domain state to presentation in one exhaustive domain lookup.
Share visual tone/indicator treatments across consumers of that meaning.
Keep active, attention, failed, complete, and unavailable distinct where the domain needs them.
Use text, shape, or accessible phrasing alongside color.

Keep animation and reduced-motion behavior with the state-mark or activity pattern.
Keep numeric meter width and stop positions as runtime geometry.
Put meter gradient stops and threshold color treatments in the theme/recipe contract.
Do not spread raw Tailwind palette stops across readout components.

## S17 Runtime measurement

Keep virtual row heights, total size, transforms, anchors, popup bounds, and composer clearance with the measured owner.
Runtime values are not global theme tokens.
Make the visible, skeleton, and measurement representations use the same geometry contract.
Resolve actual pixel lengths before passing CSS sizes to JavaScript layout libraries.
Do not parse `rem` or `calc()` as pixels with `parseFloat`.

## S18 Proof and mechanical gates

The implementation must add these error-level checks. They do not exist merely because this document names them.

- Registry identity: Compare every installed file with the recorded transformed payload baseline.
- Ownership: Reject app/domain imports and app-owned variants/recipes in registry space.
- Typography: Preserve default Tailwind scales and reject undefined app recipes.
- Cascade: Test both raw and adapted computed metrics in a dedicated browser contract suite.
- Theme completeness: Require every role in both appearances for each registered theme.
- Color usage: Reject uncataloged product palette literals, while retaining named data/asset/mask exceptions.

Give each gate a failing fixture or temporary mutation proof before enabling it.
Use Storybook `play` for visible behavior and accessible semantics, with the existing required axe scan.
Keep computed-style assertions in the dedicated browser contracts, not those play functions.
Run Light and Dark, plus the accepted System/persistence/native/editor/diagram Electron theme flow.
Include focused source/compiler checks for registry identity and token completeness.

A source hash cannot prove accessibility, interactive fit, clipping, or rendered appearance.
Record which proof ran and which remains unverified.
Existing vendor lint/dead-code exemptions do not authorize handwritten app files in vendor space.

## S19 Escalation and forks

Try the public slots, native variants, and app composition before proposing a fork.
If overrides require repeated important classes or changes to private DOM, stop and describe the required structure.
Prefer an app-owned composition of stable primitives when that structure is small.
Use an explicit fork only after human approval records why composition cannot satisfy the requirement.

Store an approved fork outside `components/ui/` and give it an app name.
Record its upstream identity, required changes, update owner, and regression tests.
Apply the same token/recipe/interaction rules to the fork.
No current file receives an automatic fork exemption from this audit.

## Instruction changes required for adoption

Replace the desktop instruction that assigns an app typography role to every reader-visible string.
State that registry text uses its registry contract and app text uses an approved recipe or intentional inheritance.
Replace the single-file token location claim with this theme/value/binding ownership contract.
Route component, styling, theme, and upstream-update edits to this contract through one short AGENTS pointer.
Change typography tests that currently require remapped `text-xs`, `text-sm`, and `text-base`.
Install the mechanical checks before claiming that agents cannot drift.

Keep this as one authority. Existing research explains evidence rather than restating active rules.
No migration aliases or legacy compatibility layer are required because the app is not live.
