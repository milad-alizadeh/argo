# The composer's command menu — build inventory (#685)

What assembling the `/` menu actually forced out of
[`cockpit-composer-picker.md`](cockpit-composer-picker.md). The names were frozen at approval;
renaming one is a migration. This ticket builds the `/` half only — the `+` menu (`AddMenu`), the
`@` file rows (`FileMenuRow`), the built-ins strip (`CommandMenuStatus`) and the feed's
`MentionSpan` / `SkillLoadedMarker` belong to #686, #687 and #689.

## Extracted — #685

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `CommandMenu` | organism | `ArgoUI/Shell/Deck/Composer/` — one caller (`SessionComposer`) | `menu: CommandMenuProjection.Menu` · `marked: String?` · `pick: (Row) -> Void` | `CommandMenuSection`, `CommandMenuRow`, `CommandMenuEmpty` on `.regularMaterial` at `ArgoRadius.popover` | frozen table, `CommandMenu`; [`slash.png`](composer-picker/slash.png) |
| `CommandMenuRow` | molecule | same — one caller (`CommandMenu`) | `row: CommandMenuProjection.Row` (`command` · `matched: Range<Int>` · `description: String?` · `origin: String?` · `shadowsUser: Bool`) · `isMarked: Bool` | three `Text` runs for the name, one for the description, two badges | frozen table, `CommandMenuRow`; [`slash-edge.png`](composer-picker/slash-edge.png) |
| `CommandMenuSection` | molecule | same — one caller (`CommandMenu`) | `label: String` · `detail: String?` | two `Text` at `sectionLabel` and `machineCaption` | frozen table, `CommandMenuSection` |
| `CommandMenuEmpty` | molecule | same — one caller (`CommandMenu`) | `query: String` | one `Text` in three runs | frozen table, `CommandMenuEmpty`; [`slash-zero.png`](composer-picker/slash-zero.png) |
| `CommandMenuCursor` | value | same — two callers (`SessionComposer`, its tests) | `settle(over:)` · `up(over:)` · `down(over:)` · `row(in:)` | — | Acceptance: navigable by keyboard alone |
| `CommandMenuProjection` | value | same — the derive, plus `+Derive.swift` | `menu(for:in:)` · `query(in:)` | — | Decisions 2, 3, 4, 5, 7, 8 |

Extraction evidence, in the order it arrived:

- **`CommandMenuRow` and `CommandMenuSection`** — repetition, and immediately: the unfiltered menu
  draws eleven rows under three headers. Two copies is the trigger.
- **`CommandMenuEmpty`** — a state the happy path never renders. It is not a row: it carries no
  cursor, no hover and no pick, and inlining it in the list would put a fourth branch in the
  `ForEach` that never runs while anything matches.
- **`CommandMenu`** — the frozen name, and it holds three things nothing below it can: the
  material, the sticky-header pinning, and the counted list height.
- **`CommandMenuCursor`** — it had its second caller before the first row was drawn. "Navigable by
  keyboard alone" is a behaviour, and a `@State private var marked: String?` inside the view would
  have left it assertable only by rendering.
- **`CommandMenuProjection`** — the container/View split `ui-components.md` requires. Every rule the
  design states about ORDER is here rather than in a `body`.

## What stayed inline

- **The catalog read and the keys** — `SessionComposer` holds `catalog`, `cursor` and `isDismissed`
  and wires `onKeyPress` / `onExitCommand` itself. The menu is not a second field: the caret never
  leaves the composer, which is why `.popover` was refused too.
- **⏎'s answer** — inside `SessionComposer.submit()`, not an `onKeyPress` above the field. A
  `TextField` takes Return itself and there is no intercepting it from outside, so insert-vs-send is
  decided at the one place that already knew which it was.
- **The insertion** — `ComposerDraft.take(_:)`, beside the draft's other mutations rather than in a
  view. What ⏎ does to the field is a draft rule.
- **The menu's place on screen** — a row in `SessionComposer`'s own stack above the vessel. The
  composer is anchored to the feed's bottom edge, so a row there grows upward with no offset to keep
  in step. An overlay needed the menu's own height to place itself and drifted the moment the list
  did.

## Contract changes these needed

**None.** The two numbers the design derives —
`ArgoComposerVessel.commandRowHeight` (27) and `commandSectionHeight` (24), with
`commandListCeiling` (294) built from them — are arithmetic over `ArgoTypography` and `ArgoSpacing`
beside the vessel's own measurements, spelled as the derivation rather than as constants. Exactly
what the design's token reconciliation said would happen, and no promotion.

One thing the renders exposed that the design could not: **the list has to be COUNTED, not
capped.** A `ScrollView` given `maxHeight` takes all of it, so a two-row menu came out ten rows tall
with eight rows of nothing under it. `CommandMenu.listHeight` sums the rows and headers and clamps
at the ceiling — which is what those two derivations are for.

## Amended during the build

- **No leading Ion Blue edge on the cursor row.** The design specified one; the cockpit draws no
  leading rules on rows anywhere, and this would have been the only one in the shell. The cursor is
  `surface.marked` and hover is `surface.hover`, which still keeps them two different inks — the
  thing the design's rule was actually protecting. `cockpit-composer-picker.md`'s measurement table
  and token reconciliation both say so now. The same sweep took the leading accent rule off
  `QueuedTurnChip`, the only other one in `ArgoUI`.
- **One type role across a section header.** The design set the label in `sectionLabel` and its
  path in `machineCaption`. Both are 11, but SF Mono beside SF Pro on one line reads as two sizes,
  so the whole line is `sectionLabel` and only the ink separates them.

## Engine changes this needed

- `SessionDriver.canRunCommands` became **`canRunCommands(for:)`**. #698 left the note: stated
  jointly it is `false` for every `claude` Session the moment one Codex thread is reachable.
- `Skill`, `SkillOrigin` and `SkillCatalog` became **public**, and `SkillOrigin.readFrom` carries
  what the section header says about where a group was read from.
- **Decision 7 changed the catalog's behaviour.** #698 listed a Project skill and a global one of
  the same name side by side, on the grounds that Argo had not measured which the CLI runs. The
  design settles it: the nearer origin wins, the shadowed copy is not listed, and the winning row
  says `shadows yours`. Only `project` over `user` can collide — a plugin's commands are namespaced.
