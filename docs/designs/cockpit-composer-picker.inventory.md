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
| `CommandMenuRow` | molecule | same — one caller (`CommandMenu`) | `row: CommandMenuProjection.Row` (`command` · `matched: Range<Int>` · `description: String?` · `origin: String?` · `shadowsUser: Bool`) · `isCurrent: Bool` | three `Text` runs for the name, one for the description, two badges | frozen table, `CommandMenuRow`; [`slash-edge.png`](composer-picker/slash-edge.png) |
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
- **`CommandMenuProjection`** — the container/View split `rules/swift.md` requires. Every rule the
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

## Extracted — #687

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `FileMenu` | organism | `ArgoUI/Shell/Deck/Composer/` — one caller (`SessionComposer`) | `menu: WorkspaceFileProjection.Menu` · `marked: String?` · `pick: (Row) -> Void` | `FileMenuRow`, `FileMenuEmpty`, on `ComposerMenuSurface` | [`at.png`](composer-picker/at.png) |
| `FileMenuRow` | molecule | same — one caller (`FileMenu`) | `row: WorkspaceFileProjection.Row` (`path` · `name` · `directory: String?` · `isTouched`) · `isCurrent: Bool` | two `Text` and one badge | frozen table, `FileMenuRow`; [`at.png`](composer-picker/at.png) |
| `FileMenuEmpty` | molecule | same — one caller (`FileMenu`) | `query: String` | one `Text` in three runs | a state the happy path never renders |
| `ComposerMenuSurface` | modifier | same — two callers (`CommandMenu`, `FileMenu`) | `label: String` | — | the D14 recipe both menus wear |
| `WorkspaceFileProjection` | value | same — the derive, plus `+Derive.swift` | `menu(for:in:touched:)` · `mention(in:)` · `rowCeiling` | — | Decisions 2, 12, 13 |
| `TouchedFiles` | value | same — one caller (`SessionComposerProjection`) | `touched(in:within:)` | — | "Files this Session has touched sort first" |
| `WorkspaceFileReader` | value | `ArgoEngine/Repository/` — the `gitWorkspaceFileRead` port | `files(at:)`, an `actor` | — | Acceptance: only paths inside the Workspace, and a large tree never blocks |

Extraction evidence, in the order it arrived:

- **`FileMenuRow`** — repetition, immediately: the bare `@` draws seventeen rows. It is not
  `CommandMenuRow` with different words. That row inks its matched characters and this one must
  not; that row carries a description and an origin, this one a directory cut from the left and a
  mark. Two of the four parts differ, which is a different row.
- **`ComposerMenuSurface`** — repetition of the *plane* rather than of a row. `CommandMenu` held
  the material, the radius, the rim and the shadow inline because it was the only wearer. It has a
  second now, and D14's recipe drifting between two menus over one field is exactly the drift a
  modifier prevents.
- **`FileMenu`** — it holds the counted list height, and it is the one place that says this list
  has no sections. Generalising `CommandMenu` to draw either would have meant a menu that branches
  on which of two shapes it is, in a `body`.
- **`FileMenuEmpty`** — a state the happy path never renders, and not a row: no cursor, no hover,
  no pick.
- **`WorkspaceFileProjection`** — the container/View split, and the home of every rule the design
  states about where `@` opens and what order files come in.
- **`TouchedFiles`** — its own value because it reads the TRANSCRIPT, which the composer otherwise
  never touches. Sitting inside the composer projection it would have been a second, quieter
  reading of the stream the feed already draws.
- **`WorkspaceFileReader`** — the engine seam. #685's note says no view reads the filesystem, and
  this one shells out besides.

## What stayed inline — #687

- **The insertion** — `ComposerDraft.take(mention:replacing:)`, beside `take(_ command:)`. What a
  pick does to the field is a draft rule, and the two differ in exactly one way worth having them
  side by side for: a command replaces the LINE, a mention replaces the TOKEN.
- **Which menu is open** — `SessionComposer+Menus`, an extension on the vessel rather than a value.
  It reads four pieces of the vessel's own `@State`, and a value taking all four would have been
  the vessel with a different name.
- **The zero state's words** — `FileMenuEmpty` carries its own lead and tail rather than sharing
  `CommandMenuEmpty`'s. "No skill or command matches" and "No file in this Workspace matches" are
  two sentences, and the shared half is four words.
- **The Workspace root** — `SessionComposerProjection.Composer.workspaceRoot`, off
  `session.workspaceLocation`. No new engine fact, so ADR-0027's mapping is untouched.

## Amended during the build — #687

- **No accent inking on a file row's matched characters.** The measurement table's row block covers
  `FileMenuRow`, and `at-filter.png` draws none. The render is right and the table's silence about
  the difference was the omission: the match is a SUBSEQUENCE over the whole path, so `sesdri`'s
  six characters land in six different segments — inking them speckles the row rather than pointing
  at anything. Over a command name the match is a substring and one contiguous run, which is what
  makes the same rule work there.
- **The `@` menu has no sections and no status strip.** One clock reads the tree, where the `/`
  menu joins two halves with two clocks and has to say so (decision 9). `at.png` shows it: eleven
  rows and no header. The list ceiling is unchanged and lands exactly there — 300 over a headerless
  list of 27pt rows is eleven and the top of a twelfth.
- **`CommandMenuCursor` became `ComposerMenuCursor`, keyed by id.** One cursor for both menus,
  because only one is ever open. Not a frozen name, so not a migration.
- **The `@` read is async and the `/` read is not.** `SkillCatalog` walks a handful of directories;
  this shells out to `git ls-files` over a tree that can hold a hundred thousand paths. It is
  launched when the token OPENS rather than on every keystroke, and the composer never waits on it.
- **The derive caps its rows at fifty.** The list draws eleven. The READ is uncapped — every path
  stays reachable by typing — but building a row per match on a monorepo would stutter the field.
- **`@` is not gated on `canRunCommands`.** Decision 14 in code: a `codex` Session draws no `/`
  menu and a full `@` one. Nothing new in the engine is needed for it, because the picker's own job
  IS the expansion — six keystrokes become a path, and `SessionTurn.text(_:attaching:)` already
  hands a file over to both adapters as a path their agent reads.

## Engine changes this needed — #687

- **`WorkspaceFileReader`** and the `WorkspaceFileRead` port beside it, mirroring `WorkspaceReader`
  and `WorkspaceRead`. `git ls-files --cached --others --exclude-standard -z` at the Session's own
  cwd. Three things at once: it cannot name a path outside the tree, it honours `.gitignore`
  without Argo reading one, and it costs one process where a walk costs a syscall per directory.
  `-z` is load-bearing — split on newlines, a filename containing one becomes two paths that do not
  exist.

## Not claimed by any ticket

**`MentionSpan`** — the frozen table's tenth name, an `@` mention inked inside the user's own
bubble in the feed. No render draws it and no acceptance criterion asks for it, so #687 left it.
Decision 18 is still its source when somebody picks it up.

## Extracted — #688

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `SkillLoadedMarker` | molecule | `ArgoUI/Shell/Deck/Feed/` — one caller (`FeedRowView`) | `skill: FeedSkillLoad` · `isOpen: Bool` · `open: () -> Void` | one `ArgoGlyph`, two `Text` runs and an `ArgoDisclosure` on `surface.glassTint` at `ArgoRadius.marker` | frozen table, `SkillLoadedMarker`; [`loaded.png`](composer-picker/loaded.png) |
| `FeedSkillLoad` | value | same — the derive beside the view | `load: SkillLoad` · `address: String` · `isExternal: Bool` · `spoken` · `ink` · `opened: FeedEvidence?` | — | Acceptance: the panel shows the `SKILL.md` body, and a read failure states itself |

Extraction evidence, in the order it arrived:

- **`SkillLoadedMarker`** — a known cross-screen unit, and three states the happy path does not
  render: the body Argo read, the file it could not, and the one with nothing behind it. The third
  draws no chevron, which is a branch a still has to be able to reach.
- **`FeedSkillLoad`** — the container/View split `rules/swift.md` requires. It also carries the
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
- **`SkillFrontmatter.body(of:)`** — #685's PARSER reused rather than a second one grown, which is
  what #688's own note asked for. A file with no frontmatter is all body. The two callers still
  reach the bytes by different routes — `SkillCatalog` walks a directory tree, this is handed one
  path — so what they share is `SkillLoad.fileName` and the parse, not the read.

## Amended during the build — #688

- **A built-in command gets no marker.** The ticket read as though every `/command` took one, with
  the built-in's panel simply absent. But `Skill Loaded: clear` is a false sentence: the transcript
  records **no skill load** for a built-in, so the marker would be Argo's own invention about a
  thing that did not happen. What the record does carry about one is already drawn — the line the
  user typed, in their bubble, and the `<local-command-stdout>` beside it as a Tool Call row. The
  marker is emitted from the skill-load record alone. `cockpit-composer-picker.md` decision 18 says
  so now; built-ins in the menu are #686's.
- **`promptEvents` moved out of `TranscriptReader` into `HarnessRecord.swift`.** Not a tidy-up:
  `metaEvents` pushed the actor past the 170-line `type_body_length` cap, and `promptEvents` reads
  a user record and touches no actor state, which is exactly what that file is for.
- **The shipping preview transcript carries no marker.** A marker let into it moves the prose sets
  and the cursor stills that are filtered out of it, and the ticket asks that every existing feed
  fixture project identically. The marker's own specimens project from their own stream instead —
  `feedSkillLoaded` is the design's render, prompt and all.

## What review changed after the build — #687

Three fresh contexts read the diff: a Standards axis, a Spec axis, and a pixel judge that saw only
the renders and the design. Two of them found the same bug from opposite ends.

- **The cursor never settled on the list it walks.** `settle(over:)` ran inside `opened()`, on the
  pass that LAUNCHED the tree read, so it settled over the empty list and nothing settled it again
  when the rows landed. The Spec axis read it in `submit()` — ⏎ falls past both menus to
  `draft.submit` — and the judge measured it as zero luminance variation across a list whose
  `at.png` marks row one at +14.6. It now settles on `onChange(of: markedIDs)`, so the cause of the
  change does not matter. Re-measured after the fix: +14.9 on row one.
- **The zero line spoke for a tree it had not read.** `workspaceFiles` was `[String]`, so "no file
  in this Workspace matches" was said while the read was still in flight. It is `Tree?` now — nil
  until the read answers, and the menu stays shut rather than lying. `mentionMenu`'s own comment
  already insisted on that distinction for a Session with no Workspace.
- **`@` reached the agent on `claude` only.** Insertion was the whole of it, so a `codex` Session
  got a bare path in prose — while the ticket's own argument for offering `@` there is that Argo
  does the work itself. `resolvesMentions(for:)` is now a port fact keyed by Session, like
  `canRunCommands`: where it answers false, `ComposerMentions.attaching` names the mentioned files
  on the Turn through the SAME attachment path a drop takes. Which is also what satisfies "observable
  in the feed at the point the agent looked" with no new rendering — an attachment is observable
  because the agent's own `Read` shows, and a mention now rides that.
- **The mentions never become chips.** They are added at SEND and never to `draft.attachments`, so
  the tray stays empty and decision 12 holds. A file both dropped and mentioned is named once.
- **The three adapter facts became one type.** `resolve(for:canAttach:canRunCommands:)` was already
  at the 3-parameter cap, and `Capabilities` is the type those flags were asking to be — they travel
  together from `CockpitView` to the vessel and are read off one port for one Session.

## Measured, not reasoned about — #687

- **The derive costs 3ms over 100k paths, down from 23ms.** `Tree` folds each path to lowercased
  UTF-8 BYTES once per open. Walking a `String` walks graphemes, which was the whole cost; the
  two-pass `rows` also stopped concatenating a fresh 100k array per keystroke.
- **Debug reverses the result** — 358ms prepared against 403ms bare, because debug is retain/release
  and bounds checks rather than the algorithm. Any re-measurement has to be `swift test -c release`.
  The first version of this fix was tuned against debug numbers and made the release path slower.

## What the missing render was hiding — #687

`composerAtDeep` exists because no captured state exercised the directory's left cut: every path the
design was drawn against fits its row, so `.truncationMode(.head)` was never once drawn. The judge
called it the rule most likely to be built backwards and the one thing the captures did not check.

It was right, and the rule WAS half broken. Rendered at `ARGO_WINDOW_SIZE=620x460`, three rows read
correctly — filename whole, directory cut from the left — and the fourth came back
`WorkspaceFileProjection+Derive.swi…`, the FILENAME truncated beside a directory that still had
room. An `HStack` under pressure shrinks every child, and nothing said which one should yield.

`name` now carries `.layoutPriority(1)`, so the directory absorbs the cut and only a filename too
wide for the whole row is truncated. Re-rendered: all four filenames whole, all four directories
carrying a leading ellipsis.

The width matters to the case. The specimen's default window is wide enough that every path fits,
which is exactly why this survived the first render of the same case — `ARGO_WINDOW_SIZE` is part of
the state here, the way `rules/swift.md` says it is for anything laid out in columns.

## Extracted — #689

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `AddMenu` | organism | `ArgoUI/Shell/Deck/Composer/` — one caller (`SessionComposer`) | `rows: [ComposerMenu.AddRow]` · `current: String?` · `pick: (AddRow) -> Void` | `AddMenuRow` on `ComposerMenuSurface`, `.fixedSize` so it hugs its longest row | frozen table, `AddMenu`; [`plus.png`](composer-picker/plus.png) |
| `AddMenuRow` | molecule | same — one caller (`AddMenu`) | `row: ComposerMenu.AddRow` · `isCurrent: Bool` | one `ArgoGlyph`, two `Text` runs | `plus.png` — not in the frozen table, which names no per-row type for `AddMenu` |
| `ComposerMenu.AddRow` | value | same, plus `ComposerMenu+Add.swift` | `id` · `label` · `sigil`; `key` and `icon` are DERIVED off `sigil` rather than stored | — | design decision 11 |

Extraction evidence, in the order it arrived:

- **`AddMenuRow`** — repetition, immediately: the two-row drawer draws the same shape twice.
- **`AddMenu`** — the frozen name, and it holds the one thing nothing below it can: `.fixedSize`,
  which is what makes it hug its longest row rather than take the vessel's own width the way
  `ComposerMenuList` does on purpose.
- **`ComposerMenu.AddRow`** — the same "value types live under the `ComposerMenu` namespace, not
  the View" convention `Listing`/`Row`/`Sigil` already set in #685 and #687, extended here:
  `ComposerMenus` (a plain, non-`View` struct) reads `addRows(on:)` from a non-isolated context,
  and putting the derive on `AddMenu` itself would have coloured every caller `@MainActor` for no
  reason a View's own isolation should ever force on a value type.

## What stayed inline — #689

- **Which listing a pick opens** — `ComposerMenus.addOpened()` / `addClosed()` / `addMenuPick(on:)`
  / `addMenuPicked(_:)`, beside the state they read in `ComposerMenus+Add.swift`. Not a value of
  its own: each is a few lines of transition over fields `ComposerMenus` already owns.
- **The insertion** — reuses `ComposerDraft.take(_:)` and `ComposerMenu.Listing.pick(_:)`
  unchanged. A pick off a requested listing is the SAME `Pick` value, with `dropping: 0` rather
  than `query.count + 1` — see *Amended* below.
- **Where the opened listing is drawn** — the SAME `SessionComposer.menu` slot `/` and `@` already
  render into, branching on `menus.isAddMenuOpen` first. `AddMenu` never gets a slot of its own.

## Amended during the build — #689

- **The row spec table names no icon, but `plus.png` draws one per row** — a folder before "Files
  in this Workspace", a mark before "Skills & commands". The render is the spec where the table is
  silent (`cockpit-composer-picker.md`'s own framing). `ArgoSymbol.addMenuFiles` and
  `.addMenuCommands` derive off the row's own `sigil` rather than becoming a fourth stored field,
  which is also what keeps `AddRow` under edge 6's 4-parameter cap on a synthesized init.
- **A pick off `AddMenu` drops nothing, where a typed `/` or `@` drops the sigil and whatever
  followed it.** `ComposerMenu.Listing` gained a `dropping: Int` field — it was computed inline as
  `query.count + 1` — so `AddMenu`'s row can open the SAME derive (`ComposerMenu.commands(for:
  "/", in:)`, `ComposerMenu.files(for: "@", in:touched:)`) with `dropping: 0`: the sigil there was
  never typed, so there is nothing of its own for a pick to remove before inserting.
- **No live filtering behind a listing `AddMenu` opened.** Typing a character — as opposed to a
  pick — closes it and falls back to the ordinary text-driven derivation. The renders show the
  field's placeholder unchanged across the `plus.png` → `plus-files.png` transition, and none of
  the eighteen numbered decisions asks for continued keystroke filtering from this entrance: `+`
  buys discovery of the SAME two listings `/` and `@` already filter, not a third interaction of
  its own.
- **`ComposerMenusOpening`**, a `package` enum (`.closed` · `.addMenu` · `.files` · `.commands`)
  threaded through `SessionComposer.init` and `ComposerSpecimen.init` — the seam that lets a
  Specimen seed `AddMenu`'s open state before the first render, since nothing about it is reachable
  from `draft.text` the way `/` and `@` are. Production always passes `.closed`. Applied in the
  SAME `onChange(of: composer.sessionID, initial: true)` pass `sessionChanged(to:)` runs in, and
  never a second `onChange`: `sessionChanged` itself clears any seeded opening, so applying the
  seed after it in the same closure is what makes it survive the mount.

## Engine changes this needed — #689

None. `AddMenu`'s two rows read `line.workspaceRoot` and `line.canRunCommands`, both already on
`ComposerMenuLine` since #685 and #687.

## Contract changes these needed — #689

None. `AddMenuRow` reuses `ComposerMenuSurface`, `ArgoComposerVessel.commandRowHeight` and the
existing `body` / `machineCaption` roles unchanged — no token promoted.
