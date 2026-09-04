<!-- status: built
     approved-at: 02a85207
     built-at: c48dc716
     prototype: prototype/590-picker -->

# The composer's command menu and Add menu

The approved design for how a user reaches a skill, a command or a file from the composer,
settling [#590](https://github.com/milad-alizadeh/argo/issues/590) under
[#535](https://github.com/milad-alizadeh/argo/issues/535). Scoped by the
[#589](https://github.com/milad-alizadeh/argo/issues/589) grill, which settled *what* is
essential; this settles what it looks like.

**The renders in [`composer-picker/`](composer-picker/) are the spec.** One PNG per state,
1440×860, taken from the study with its switcher hidden. The measurements below are the numbers a
ticket must carry — prose that omits them cannot be failed for getting them wrong.

> **One place the renders are now stale.** Every PNG that draws the keyboard cursor — `slash.png`,
> `slash-edge.png`, `slash-late.png`, `slash-fail.png` — still puts a leading Ion Blue edge on that
> row. #685's build removed it: the cockpit draws no leading rules on rows, the ground alone carries
> a marked row, and the measurement table below is the amended truth. The renders were not re-shot:
> they come from a prototype branch, not from the app, so re-shooting them would mean re-running a
> study to change one rule. **Judge those four against the table, not against the edge.** Everything
> else in them still holds.

**The composer is untouched.** [`cockpit-session-composer.md`](cockpit-session-composer.md) froze
the vessel, its footer and their measurements; this design only adds the surface that opens over
it, and one rename on the footer's leading control. Every render here draws the frozen composer.

The study lives on the throwaway branch `prototype/590-picker`
(`docs/designs/prototypes/composer-picker-prototype.html`), where every state is reachable as
`?variant=A&state=<key>` and the two variants this one was chosen against are still drawable.
It is there to be re-explored, not built from.

## It is a menu, not a popover

The surface hangs off the field the reader is typing in, which by
[D14](cockpit-visual-identity-decisions.md) makes it a **menu**: "nearly opaque graphite with a
restrained glass edge", the recipe the run-settings popover already uses on this same footer. It
is **not** Liquid Glass. Glass is rationed to the sidebar, to top control islands and to surfaces
standing over the reading on their own; the composer's vessel is already glass, and a glass list
over it would be the layering Apple's own guidance asks you to avoid ("avoid overcrowding or
layering Liquid Glass elements on top of each other"; "use Liquid Glass effects sparingly").

**No `.glassEffect` and no `GlassEffectContainer` on this surface.** The alternative — the vessel
growing the list inside its own rim, morphing via `glassEffectID` — was drawn, and lost on exactly
this rule. It is variant B on the study branch.

Named as a menu, it is also freed from the popover rule it would have failed: HIG asks a popover
to hold "a small amount of information or functionality… a few related tasks" and to avoid being
too big, and this holds a filtering catalogue of 75 things.

## Component names — frozen

Renaming one of these later is a migration, and seven of them were: #751's collapse of the twin
menus into one family retired every `CommandMenu*` and `FileMenu*` name at once, and #752 added
two more of its own. The middle column below carries what each shipped name was frozen as, and
[`cockpit-composer-picker.inventory.md`](cockpit-composer-picker.inventory.md) records why each
one moved. **The shipped name is the one to cite**; the older name is kept here so a reader holding
an older document can find its way forward, and for no other reason. Rows marked *added* were never
frozen and were never renamed; rows whose middle column names a build's own name were renamed too,
but from a name this table never carried, so they are not among the seven. Both kinds are listed
here so the whole family reads in one place rather than half here and half in the inventory.

| name | was | what it is |
|---|---|---|
| `AddButton` | `AttachButton` | the footer's leading `+`. **Renamed in #708** — see below |
| `AddMenu` | `AddMenu` | the two-row menu `AddButton` opens: files, skills & commands |
| `AddMenuRow` | *added, #689* | one row of it: the mark, the words, the shortcut key |
| `ComposerMenuList` | `CommandMenu`, `FileMenu` | the list a sigil opens: a status strip where there is one, then the rows, sectioned where the sigil groups them. **One list for both sigils** |
| `ComposerMenuSurface` | *added, #687* | the graphite plane all three menus stand on |
| `ComposerMenuRow` | `CommandMenuRow`, `FileMenuRow` | one pickable thing — what it is, what identifies it, any mark it carries. **One row for both sigils** |
| `ComposerMenuSection` | `CommandMenuSection` | the origin header, with its count and where its group came from |
| `ComposerMenuStatusLine` | `CommandMenuStatus` | the pinned strip that says the built-in half is late or unavailable |
| `ComposerMenuZeroLine` | `CommandMenuEmpty` | the one line drawn when nothing matches |
| `ComposerMenuCursor` | `CommandMenuCursor` — #685's own name, renamed by #687 | where the keyboard is in whichever menu is open |
| `ComposerMenu` | `CommandMenuProjection` · `WorkspaceFileProjection` — #685's and #687's own names, both collapsed by #751 | the derive and the values it answers in — `Listing`, `Section`, `Row`, `Status`, `Sigil`, `Pick`, `AddRow` — with one file per sigil |
| `ComposerMenus` | *added, #752* | which menu the line has open, and where the keyboard is in it |
| `ComposerMenuLine` | *added, #752* | everything about the draft and the Session that decides which menu opens |
| `MentionSpan` | `MentionSpan` | an `@` mention inside the user's own bubble in the feed. **Unbuilt** — claimed by no ticket |
| `SkillLoadedMarker` | `SkillLoadedMarker` | the feed marker, with its evidence affordance when there is a body behind it |

`AttachButton` **becomes `AddButton`**, accessibility label *Add to this turn*. It opens files,
skills and commands, and two of those three are not attachments; a name that says `Attach` makes
every later reader expect a file picker behind it. The `+` glyph the composer design froze does
not change, so the footer's drawing is unaffected. Rejected: `PlusButton` (names the glyph, and
dies the moment the glyph changes) and `ComposerMenuButton` (names the mechanism). The rename
touches built code (`ArgoUI/Shell/Deck/Composer/`), so it is a migration step on the
implementation ticket, not a side effect of another change.

**`CommandMenu` is not a name this app can take back.** SwiftUI ships its own `CommandMenu`, and
`ArgoUI` uses it — `Shell/NavigateCommands.swift` and `Argo/ArgoApp.swift` each build one. A type
of that name inside the module shadows the framework's, so restoring the frozen name would break
both call sites. The collapse in #751 is why the family reads `ComposerMenu*`; this is why it
cannot read `CommandMenu*` again.

## Measurements

Everything below is a token, or derived from one. Nothing here is a number to copy into a view
except where it says *measured*.

**The surface** — `ComposerMenuSurface`, and `ComposerMenuList` standing on it

| what | value |
|---|---|
| material | `.regularMaterial`, the run-settings popover's recipe. **Not glass** |
| radius | `ArgoRadius.popover` (12) |
| border | `ArgoStroke.border` (1) at `edge.glassRim` — the restrained edge D14 allows |
| inset | `ArgoSpacing.tight` on all four sides |
| width | the vessel's own. **No stated width**: the description is the content, and at 560 two thirds of a real one is an ellipsis |
| anchor | the vessel's leading edge, rising `ArgoSpacing.base` above its top |
| list ceiling | **300** = 10 rows (27) + one section header (30). Derived, not measured — it moves with the header, which grew to 30 during #685's build |

**A row** — `ComposerMenuRow`, one for both sigils

| what | value |
|---|---|
| height | **27** = `ArgoTypography.machine.lineBox` (12 × 1.21 → 15) + `ArgoSpacing.snug` either side. Derive it; do not restate it |
| inset | `ArgoSpacing.base` leading and trailing |
| gap between parts | `ArgoSpacing.base` |
| radius | `ArgoRadius.control` (6) |
| name | `ArgoTypography.machine` (mono 12), ink `primary` |
| ~~argument hint~~ | **dropped during #686's build — see decision 6.** No CLI surface carries `argumentHint` |
| description | `ArgoTypography.rowMeta` (11), ink `tertiary`, one line, tail-truncated |
| origin | `ArgoTypography.badge` (10, semibold, tracking 0.6), ink `disabled`, upper-cased |
| shadow marker | the same `badge` role in `state.attention` |
| matched characters | ink `accentBright`, weight `semibold` — **on a COMMAND row only. Amended during #687's build: a file row inks none.** There the match is a subsequence over the whole path, so six characters land in six different segments and inking them speckles the row; over a command name the match is one contiguous run, which is what makes the rule work there. `at-filter.png` already drew it this way |
| hover | `surface.hover` (0.045), no edge |
| keyboard cursor | `surface.marked` (0.07), the ground alone. On the cursor row the description lifts to `secondary`, which is `TextRoles.marked(on:)`'s own floor. **Amended during #685's build: no leading Ion Blue edge.** The cockpit draws no leading rules on rows, and one here would have been the only one in the shell — the two grounds are still different inks, which is what the rule below actually asks for |
| file row | name at `machine`, then the directory at `machineCaption` in `tertiary`, **cut from the left** — a nine-segment path is a column of identical prefixes |

**A section header** — `ComposerMenuSection`

| what | value |
|---|---|
| height | **30** = `sectionLabel.lineBox` (11 × 1.21 → 14) + `ArgoSpacing.comfortable` above + `ArgoSpacing.tight` below, and **24** for the first header, which has no group above it to be separated from and takes `ArgoSpacing.snug` instead — the same inset a row holds its own text off its edges by, so the list's first line and its last stand off the surface equally. **Amended during #685's build**: the gap above was `snug`, and it grew when the header lost its ground — see *behaviour* |
| label | `ArgoTypography.sectionLabel`, ink `tertiary`, upper-cased |
| its count and path | the SAME role as the label, ink `disabled`, **not** upper-cased. **Amended during #685's build**: it was `machineCaption`, and SF Mono beside SF Pro reads as two sizes on one line even though both are 11 |
| behaviour | scrolls with its own group. **Amended during #685's build**: it was sticky, which needs a ground of its own to stop rows showing through — and the band that ground draws is louder than the grouping is worth. The top margin does the separating instead |
| order | Project · Global · Plugin · Claude Code — nearest origin first. **Amended during #685's build**: the user's own origin reads `Global`, not `You` — it is where the skill lives, and every other word on this row names a place |

**The `+` menu** — `AddMenu`

| what | value |
|---|---|
| width | **none.** It hugs its longest row, the way the Mode control hugs its selected rung |
| rows | two: *Files in this Workspace* `@`, *Skills & commands* `/` |
| row type | `ArgoTypography.body`; the key on the trailing edge at `machineCaption` in `disabled` |
| anchor | above the whole vessel, `ArgoSpacing.base` clear of it — never over the field it adds to |

**No footer.** The study printed `↑↓ move · ⏎ insert · esc dismiss`; those are the platform's own
conventions, and [decision 2 of the composer design](cockpit-session-composer.md) already refused
printing them on this vessel. Its 9px key caps were the only values on this surface under the type
scale's 10pt floor. The counts it carried live on the section headers, per origin, where they say
more.

## Decisions the renders encode

1. **Selecting inserts text; it never sends.** `⏎` inserts `/name ` and leaves the caret after it.
   A command with arguments is the common case, and sending on `⏎` makes the argument impossible
   to type. The composer stays sendable throughout — `slash-args.png`. **`⇥` takes the same row
   `⏎` would, added in #1181**: it is the completion key every other such menu answers, and over
   the `+` menu it opens the row's section, exactly as `⏎` does there (decision 11). With no row
   under the cursor — no menu, or a filter that matched nothing (decision 8) — `⇥` is the focus
   walk it has always been, and `⇧⇥` never touches the menu at all.
2. **`/` opens at any token boundary; `@` always has.** A slash inside `src/foo` is a path, not a
   command — `codex.png` types `/usr/local` and opens nothing. **Amended during #1256's build:**
   `/` was head-of-line only, and a two-line draft with `/` on its second line opened no menu at
   all. It now opens wherever `@` already does — the head of the draft, the head of a later line,
   or after a space — for the same reason `@` never was head-only: the reader composes a draft
   over several lines before naming the command they mean. The second-slash rule that keeps
   `/usr/local` closed is unchanged, and closes the SAME way at every boundary, not only the
   first.
3. **Filtering narrows *and* reorders.** Prefix matches first in origin order, then name-substring
   matches under their own header, so a good match never slides down the list as the reader types.
   The matched characters are inked in the name — `slash-filter.png`.
4. **A description is the first sentence of the frontmatter's own `description:`, clamped.** There
   is no one-line description in a `SKILL.md`: the field is trigger prose for a model, and real
   ones run three sentences. Never paraphrased, never regenerated — a menu that rewrites its own
   catalogue can be wrong about it.
5. **A skill with no `description:` shows its name and nothing.** The ramp's quietest ink, no
   invented caption, and **no italic** — a role carries a face and a weight, never a slant —
   `slash-edge.png`.
6. ~~**The argument affordance is the CLI's own `argumentHint`, as ghost text after the name.**~~
   **Dropped during #686's build: nothing is drawn after the name, for a built-in or a skill.**
   The CLI does not expose `argumentHint` through any surface Argo can read. #686 reads the Help
   panel from a hidden session, and that panel prints a name and a clamped description and nothing
   else; the CLI's own `/` popup prints the same two. The field exists only inside the binary, in
   minified records whose descriptions are sometimes getters and whose hints are sometimes
   template literals — a second source, far more fragile than the panel, for a decoration.
   `slash-builtin.png` still shows the ghost text and is stale in that one respect. The rest of it
   holds, and a built-in's row is a skill's row: name, then description.
7. **A name shadowed by a nearer origin is not listed; the winning row says `shadows yours`.** The
   CLI would never run the shadowed copy, and a row the CLI ignores is a lie. This is why origin
   has to be legible at all — `slash-edge.png`.
8. **Zero matches keeps the surface and stays sendable.** One line naming what did not match, and
   the reader's line is still just text — `slash-zero.png`.
9. **The two enumeration halves have two clocks, and the slower one's state is pinned above the
   list.** Skills are a filesystem re-scan; built-ins are the version-keyed scrape. Drawn in the
   Built-in section's own place, the notice sat below ten rows of skills where nobody would see it
   — `slash-late.png`, `slash-fail.png`.
10. **A failed scrape degrades down.** "Argo could not read this CLI's built-in commands, so only
    skills are listed. Typing a built-in by name still works." No guessed list, no silent gap.
11. **The `+` menu has two rows, not three.** The CLI addresses skills and commands identically as
    `/name`, so splitting them would be two rows opening one list. **Connectors is absent, not
    disabled** — MCP is deferred with a named unlock, and a row that opens nothing promises a
    surface Argo cannot see — `plus.png`.
12. **Files come from the in-app Workspace tree, and a pick becomes an `@` mention in the text.**
    Not the system panel, which cannot produce a mention. Dropping and pasting still make
    `AttachmentChip`s (#540) — a different act with a different result — `plus-files.png`,
    `at-inserted.png`.
13. **Fuzzy path match is a subsequence over the whole path**, so a nine-segment path is reachable
    in six keystrokes — `at-filter.png`.
14. **Where the command surface cannot work it is absent, not disabled.** A codex Session has no
    command menu at all and its placeholder does not offer one; `@` still works there, because
    that is Argo-side path expansion — `codex.png`.
15. **A Permission holding the composer's slot leaves no field and no caret, so the menu cannot be
    opened** — not suppressed, cannot. Nothing new is drawn — `perm.png`.
16. **Where the composer is already absent, nothing appears** — `external.png`, `orphaned.png`.
17. **The menu opens over a running Turn exactly as at rest**, and coexists with a queued
    follow-up above the field — `running.png`, `queued.png`.
18. **The sent line is the user's own bubble, verbatim, mention and all.** A `Skill Loaded: name`
    marker comes from the transcript beside it, and opens the `SKILL.md` body Argo read. No
    expanded prompt, no third representation Argo invents — `loaded.png`. **Amended during #688's
    build: a built-in gets NO marker.** It was to get one with nothing behind it, and
    `Skill Loaded: clear` is a false sentence — the transcript records no skill load for a
    built-in, so the marker would be Argo's own invention about a thing that did not happen. The
    built-in's own line is already in the reader's bubble, and its output is already a Tool Call
    row. The marker with nothing behind it is still drawn, for the case that really has nothing:
    a `SKILL.md` that is all frontmatter.
19. **The field inks the command it will actually run, in the accent, and nothing else — added
    during #1256's build.** Decision 2's own token boundary lets a `/` open the menu anywhere in
    the draft, but the CLI reads the WHOLE draft as one prompt and runs it as a command only when
    a `/` name starts that draft. `go with these\n\n/prototype-to-design` opens the menu on its
    second line so the reader can still complete it, but sending it hands the CLI two lines of
    prose ending in a literal `/prototype-to-design` — nothing runs. The mark would lie there, so
    it stands only at index 0: `ComposerMenu.commandMark(in:)` is a stricter, separate question
    from `command(in:)`'s (which token opens the menu). The mark covers the whole name past any
    arguments too — `/implement 745 ` stays inked over `implement` — because the CLI is still
    going to run it. `canRunCommands: false` (a codex Session) withholds the mark exactly as it
    withholds the menu.

## Token reconciliation

| raw in the study | verdict | lands as |
|---|---|---|
| `12px` mono name | snap, exact | `ArgoTypography.machine` |
| `11px` description · `11px` wait and failure lines | snap, exact | `rowMeta` |
| `11px` mono argument hint | **dropped** | no CLI surface carries `argumentHint` — decision 6 |
| `13px/1.5` ghost hint | snap, exact | `body` — the field's own type, which the field already sets |
| `10px` origin badge, tracking `.4` | snap | `badge` (10, semibold, **tracking 0.6**) |
| `10px` uppercase section header | snap | `sectionLabel` (**11**) — the role whose job is a group label |
| `10px` mono section count and path | snap | `machineCaption` (**11**) |
| `12px` empty-state sentence | snap | `rowMeta` (**11**) — the rung of the descriptions it replaces |
| `9px` key caps, `10px` footer | **dropped** | the footer goes; the scale's floor is 10 and #536 decision 2 refused the hints |
| `8px` · `6px` · `4px` insets and gaps | snap, exact | `ArgoSpacing.base` · `snug` · `tight` |
| `6px` row radius · `12px` surface radius | snap, exact | `ArgoRadius.control` · `popover` |
| `1px` border | snap, exact | `ArgoStroke.border` |
| `26px` row height | **derive** | `machine.lineBox.rounded(.up)` + `snug` × 2 = **27**, the shape `ArgoBadge.height` uses |
| `285px` list ceiling | **derive** | 10 rows + one header = **300** |
| `5px` waiting dot | snap | `ArgoIconSize.statusDot` (6) |
| `268px` `+` menu width | **dropped** | the menu hugs its rows; a stated width is re-measured every time a word changes |
| `rgba(62,155,255,.18)` cursor ground + accent inset border | ground snapped, **border dropped** | `surface.marked` alone (amended during #685's build — see the cursor row above) |
| `rgba(255,255,255,.045)` hover | snap, exact | `surface.hover` |
| accent on matched characters | snap, exact | `accentBright` |
| italic on an absent description | **dropped** | the contract has no slant |
| blur, saturation, drop shadow | not ours | `.regularMaterial` draws its own; `ArgoElevation` owns the rest |

**No promotions. The contract is unchanged by this design** — the two numbers it needs are
derivations, and they belong in `ArgoComposerVessel` beside the vessel's own measurements, spelled
as the arithmetic rather than as constants.

## What the study exposed that the renders do not show

1. **The catalogue is 77 things on this machine** — 39 project skills, 3 of the user's, 16 plugin
   skills, 19 curated built-ins. The renders show ten rows; the scale is the argument for the
   feature, and it is real rather than invented.
2. **Built-in strings came out of the `claude` 2.1.228 binary**, which carries records shaped
   `{type:"local-jsx",name:"autocompact",description:"…",argumentHint:"[auto|<tokens>]"}`. That is
   where `argumentHint` was found, and it is why decision 6 existed. A ticket that instead
   scrapes the `/help` panel gets descriptions clamped to about two panel lines — which is why
   skill descriptions come from frontmatter. **#686 built the panel scrape, and the study's own
   caveat is what retired decision 6**: the panel carries no `argumentHint`, and neither does the
   CLI's `/` popup, so the field is reachable only by parsing the binary.

   Two more things #686 measured against 2.1.233, both about the hidden session rather than the
   drawing. The panel renders its **whole** list when the PTY is tall enough (400 rows holds all
   99) and marks a truncated one with a `↓`, which is what lets a short read fail loudly instead
   of answering short. And a `claude` opening a folder it has never seen **swallows the first
   keystrokes it is sent**, with nothing drawn to wait for — waiting longer does not help, so the
   reader asks for the panel again rather than asking for it earlier.
3. **Two names really do collide** on this machine (`find-skills`, `writing-great-skills`), which
   is what forced decision 7. A fixture set would not have had a collision in it.
4. **One skill in this repo genuinely has no `description:`**, which is what decision 5 is drawn
   against rather than imagined.
5. **Paths here are nine segments deep**, so the file row's left-cut directory is a measured
   response, not a preference.
6. **Blind typing already works** — #589 verified a bracketed-pasted `/command` fires the CLI's
   native handler. This surface buys discovery and descriptions, not capability.
7. ~~**`@` mentions are blocked on [#682](https://github.com/milad-alizadeh/argo/issues/682)**~~
   **Unblocked: #682 is closed.** The fix is three parts — a gap between the paste and the Return,
   the Return as its own write, and `TurnDelivery`'s watch behind both — and `ClaudeTurnTests`
   holds the `@`-bearing Turn still. #687 built the picker on top of it.

## Next

`/to-tickets` under #535, carrying the measurements above; then `design-to-code` per ticket, and
`/pixel-review` against these renders. The engine seam the UI takes its value from is #685's
composer catalog provider — this design assumes it and specifies none of it.
