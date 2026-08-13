# The composer's command menu — build inventory (#685)

What assembling the `/` menu actually forced out of
[`cockpit-composer-picker.md`](cockpit-composer-picker.md). The names were frozen at approval;
renaming one is a migration. This ticket builds the `/` half only — the `+` menu (`AddMenu`), the
`@` file rows (`FileMenuRow`), the built-ins strip (`CommandMenuStatus`) and the feed's
`MentionSpan` belong to #686, #687 and #689. `SkillLoadedMarker` is #688, appended below.

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
- **The section header draws no ground, and does not stick.** The two go together: a pinned header
  needs a ground of its own or the rows show through it, and that band is louder than the grouping
  is worth. Headers scroll with their group and a `comfortable` gap above does the separating —
  which took the header from 24 to 30, and the list ceiling with it. The FIRST header separates
  nothing and takes `snug` instead — the inset a row already holds its own text off its edges by,
  which is what makes the list's first line and its last stand off the surface by the same amount.
- **Section identity is its own, not its label.** Every plugin's section is labelled `Plugin`, so
  `id = label` collided the moment two plugins carried skills and `ForEach` drew one of them. Found
  by review, not by a render — the fixture had one plugin.
- **A prefix match is measured against the name too, not only the command.** A plugin's command is
  `/plugin:name`, so ranked off the command's own head no plugin skill could ever be a prefix match
  and typing a skill's exact name filed it under *Also contains*. Also found by review.
- **A second slash closes the menu.** Decision 2 names `/usr/local` as the line that opens nothing;
  head-of-line alone let it open the zero state. No command carries a slash in its name.

## Engine changes this needed

- `SessionDriver.canRunCommands` became **`canRunCommands(for:)`**. #698 left the note: stated
  jointly it is `false` for every `claude` Session the moment one Codex thread is reachable.
- `Skill`, `SkillOrigin` and `SkillCatalog` became **public**, and `SkillOrigin.readFrom` carries
  what the section header says about where a group was read from.
- **Decision 7 changed the catalog's behaviour.** #698 listed a Project skill and a global one of
  the same name side by side, on the grounds that Argo had not measured which the CLI runs. The
  design settles it: the nearer origin wins, the shadowed copy is not listed, and the winning row
  says `shadows yours`. Only `project` over `user` can collide — a plugin's commands are namespaced.

## Extracted — #688

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `SkillLoadedMarker` | molecule | `ArgoUI/Shell/Deck/Feed/` — one caller (`FeedRowView`) | `skill: FeedSkillLoad` · `isOpen: Bool` · `open: () -> Void` | one `ArgoGlyph`, two `Text` runs and an `ArgoDisclosure` on `surface.glassTint` at `ArgoRadius.marker` | frozen table, `SkillLoadedMarker`; [`loaded.png`](composer-picker/loaded.png) |
| `FeedSkillLoad` | value | same — the derive beside the view | `load: SkillLoad` · `isExternal: Bool` · `spoken` · `opened: FeedEvidence?` | — | Acceptance: the panel shows the `SKILL.md` body, and a read failure states itself |

Extraction evidence, in the order it arrived:

- **`SkillLoadedMarker`** — a known cross-screen unit, and three states the happy path does not
  render: the body Argo read, the file it could not, and the one with nothing behind it. The third
  draws no chevron, which is a branch a still has to be able to reach.
- **`FeedSkillLoad`** — the container/View split `ui-components.md` requires. It also carries the
  one fact the engine's `SkillLoad` cannot answer alone: whether the file read lies outside the
  Session's tree, which needs the projection's own `FeedPath`.

## What stayed inline — #688

- **The user's own line.** Untouched, and deliberately: a command is just a prompt, so it stays the
  ordinary bubble `FeedPrompt` already drew. The marker is a row beside it, never a rewriting of it.
- **The row's place in the feed.** One case in `FeedProjection.content(of:)`, in the sequence the
  record wrote it. There is no ordering rule to hold anywhere else.
- **The panel.** `FeedEvidence` already draws one step under one address; the marker builds one and
  opens the panel every call row opens.

## Engine changes this needed — #688

- **`TranscriptEvent.skillLoaded(SkillLoad)`**, read off the meta record whose first line is
  `Base directory for this skill: <path>`. Those records were dropped whole before; the rest of them
  still are.
- **`SkillReader`**, the `SKILL.md`-off-disk port, mirroring `ImageReader`. It is what makes the
  read failure falsifiable without breaking a skill on the machine.
- **`SkillFrontmatter.body(of:)`** — #685's reader reused rather than a second one grown, which is
  what #688's own note asked for. A file with no frontmatter is all body.

## Amended during the build — #688

- **A built-in command gets no marker.** The ticket read as though every `/command` took one, with
  the built-in's panel simply absent. But `Skill Loaded: clear` is a false sentence, and the
  transcript says nothing about a built-in beyond the line the user typed — which their own bubble
  already carries. The marker is emitted from the skill-load record alone. Built-ins are #686's.
