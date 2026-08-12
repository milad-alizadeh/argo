# The composer's `/` picker and `+` menu — throwaway prototype

The design study for [#590](https://github.com/milad-alizadeh/argo/issues/590), under
[#535](https://github.com/milad-alizadeh/argo/issues/535) / ADR-0024. Scoped by the
[#589](https://github.com/milad-alizadeh/argo/issues/589) grill, whose answer and spec are on
those two tickets.

> **Not settled yet.** This is the variant exploration. When one is picked,
> `prototype-to-design` lands the approved design in `docs/designs/` and this branch stays as
> the record of what it was picked against.

## Run it

```sh
open docs/designs/prototypes/composer-picker-prototype.html
```

No build, no server, no dependencies. Renders of every state are in
[`picker/`](picker/) — `<variant>-<state>.png`, taken at 1440×860 with `&bare=1`.

## The question it answers

*The composer sends text. A CLI user lives on commands, and there is no way to see one.* The
approved composer design (`docs/designs/cockpit-session-composer.md`) draws a footer of
`+` · Mode · run facts · send, where `+` is attachment only and there is no `/` surface at all.

**The composer itself is frozen** — variant B of #536, its vessel, footer and measurements. The
three variants here disagree only about the surface that opens over it.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which picker surface. Also `←`/`→`, or the floating bar. |
| `&state=<key>` | Which state. Also `↑`/`↓`, or the picker in the floating bar. |
| `&bare=1` | Hide the switcher and its caption — how the renders were taken. |

**It is drivable, not only viewable.** Typing `/` really opens the picker over the real catalog;
`↑↓` move, `⏎` inserts, `esc` dismisses, and the filter narrows as you type. That matters
because the questions here — *does a name plus a description fit one row, is 75 rows navigable*
— are answered by using it.

### The states

**The `/` surface** — `slash` · `slash-filter` · `slash-args` · `slash-builtin` · `slash-zero` ·
`slash-late` · `slash-fail` · `slash-edge`
**The `@` surface** — `at` · `at-filter` · `at-inserted`
**The `+` menu** — `plus` · `plus-files`
**Degraded** — `codex` · `running` · `queued` · `perm` · `external` · `orphaned`
**In the feed** — `loaded`

## The catalog is real, and that is the point

| Half | Count | Where it came from |
|---|---|---|
| Project skills | 39 | `.claude/skills/*/SKILL.md` in this repo — `name:` and `description:` verbatim |
| Your skills | 3 | `~/.claude/skills` — two of them shadowed |
| Plugin skills | 16 | the bundled set this machine's CLI advertises |
| Built-in commands | 19 | **extracted from the installed `claude` 2.1.228 binary** — name, description *and* `argumentHint` |
| Files | 20 | real paths from `git ls-files` |

The built-ins were not guessed and not scraped from a screen: the binary carries records shaped
`{type:"local-jsx",name:"autocompact",description:"…",argumentHint:"[auto|<tokens>]"}`, so every
string a built-in row shows is the CLI's own. The set shown is #589's curated keep list.

## What the real data settled that invented fixtures would not have

1. **A `description:` is not a caption — it is trigger prose for a model.** `/audit-agent-context`
   runs 78 words across three sentences; `/code-review` is two sentences of parenthetical. The
   ticket assumed "the one-line description from its own frontmatter" and **there is no such
   field**. Every row here shows the **first sentence**, clamped, and nothing is rewritten — a
   picker that paraphrases its own catalog can be wrong about it. This is the single biggest
   constraint on the row, and it is what makes the surface's width a real question rather than a
   taste one.
2. **Built-ins have an argument affordance and skills do not.** The CLI ships `argumentHint`
   (`/compact <optional custom summarization instructions>`, `/goal [<condition> | clear]`), so
   the affordance is drawn from the source rather than invented: ghost text after the inserted
   name. A skill has no such field, so a skill gets nothing — see `slash-args` against
   `slash-builtin`.
3. **Names collide across origins.** `find-skills` and `writing-great-skills` exist in both
   `~/.claude/skills` and this repo. The CLI runs the project copy, so the shadowed row is **not
   listed** — a row the CLI would ignore is a lie — and the winning row says `shadows yours`.
   This is why origin has to be visible at all.
4. **A skill with no `description:` is real.** `writing-great-skills` in this repo has none. The
   row shows its name and *no description in its frontmatter*, never a guess.
5. **Paths are nine segments deep.** `…/ArgoUI/Shell/Deck/Evidence/Syntax/SyntaxHighlight.swift`
   will not fit any row, so the file row leads with the filename and the directory follows
   dimmed and truncated from the left.
6. **77 things is past recall, and that is the argument for building this at all.** Blind typing
   already works (verified in #589); what it cannot do is show you that `/pixel-review` exists.

## The three variants

They disagree about the **surface**, about **how origin is stated**, and about **how much
description fits** — which are the same question asked three ways.

- **A — a popover above the vessel, origin as section headers.** The user's own starting point:
  the same material as the run-settings popover already on this footer, anchored to the vessel's
  leading edge and taking its **full width** (≈900pt at 1440), so most first sentences fit
  whole. Ten rows and a header at rest (10 × 26 + 25 = 285), then it scrolls. Sections are
  `Project · You · Plugin · Claude Code`, each carrying its own count and where it came from, so
  no row needs an origin badge. `+` opens a small two-row menu that jumps into the same list.
- **B — the vessel grows the list inside itself, origin on the row.** No second surface at all:
  the glass gets taller, the rows sit inside its own rim above the field, one hairline between
  them. Six rows (6 × 26 = 156), because the vessel has to stay a vessel. One flat
  relevance-ordered list, so origin travels on every row as a trailing badge — which at rest is
  a column of `PROJECT`, and is the cost of dropping the headers.
- **C — a command palette over the deck, three tabs, two-line rows.** Deliberately unattached: a
  640pt surface floating over the feed with its own query field and `Files` / `Skills &
  commands` tabs. The row becomes two lines, so **two full lines of description** survive — the
  most generous answer to the user's question. Its cost is drawn rather than argued: the palette
  owns the query, so the `/` you typed **leaves the draft** and the caret is no longer where you
  were writing, and a command picked against a non-empty draft has to be pushed to the head of
  the line.

## Answers the prototype commits to, in all three

These did not vary, so they are answers rather than variants. Each one is a render.

1. **Selecting inserts text; it never sends.** `⏎` inserts `/name ` and leaves the caret after
   it, because a command with arguments is the common case and sending on `⏎` makes the argument
   impossible to type. The composer stays sendable throughout.
2. **`/` opens only at the start of the line, `@` at any token boundary.** A slash inside
   `src/foo` is a path — see `codex`, where `Fix the /usr/local path…` opens nothing on an
   adapter that *has* no command surface either way.
3. **Filtering narrows *and* reorders.** Prefix matches first in origin order, then
   name-substring matches under their own dim header, so a good match never slides down the list
   as you type. The matched characters are inked in the name.
4. **Zero matches keeps the frame and says so, and the line stays sendable.** `/graphify` is a
   perfectly good thing to say to an agent; the picker is not a validator.
5. **The two enumeration sources have two clocks, and the slower one's state is pinned above the
   list.** Skills are a filesystem re-scan; built-ins are the version-keyed scrape. Rendering
   the notice in the Built-in section's own place put it below ten rows of skills where nobody
   would ever see it — `slash-fail` is the render that caught that.
6. **A failed scrape degrades down, never sideways.** "Argo could not read this CLI's built-in
   commands, so only skills are listed. Typing a built-in by name still works." No guessed list,
   no silent gap.
7. **The `+` menu has two rows, not the three the ticket asked for.** *Files in this Workspace*
   and *Skills & commands* — because the CLI addresses skills and commands identically as
   `/name`, and splitting them would be two rows opening one list. **Connectors is absent**, not
   greyed: MCP is deferred with a named unlock (#589), and a row that opens nothing promises a
   surface Argo cannot see.
8. **`AttachButton` becomes `AddButton`.** The control is no longer about attachment — see
   *The rename* below.
9. **A picked file becomes an `@` mention in the text, not an `AttachmentChip`.** The CLI
   resolves the mention itself. Dropping and pasting still make chips (#540); those are a
   different act with a different result, and the `at-inserted` seam names the #682 dependency.
10. **Nothing new appears where the composer is already absent.** `external` and `orphaned` are
    rendered to prove it, and `perm` is the sharper case: the Permission takes the whole slot, so
    there is no field and no caret — the picker **cannot** be opened rather than being
    suppressed.
11. **The sent line is the user's own bubble, verbatim.** `loaded` shows `/code-review since main
    — focus on @SessionComposer.swift` as typed, with a `Skill Loaded: code-review` marker from
    the transcript beside it. No expanded prompt, no third representation Argo invents.

## The material, and why that picks A (2026-08-12)

Checked against Apple's guidance and the house contract, and they agree: **A**, drawn in
graphite rather than glass.

**D14 decides it** (`cockpit-visual-identity-decisions.md` — *Glass is rationed by surface
hierarchy*). Glass goes to the sidebar, to top control islands, and to "major transient surfaces
such as the command palette". Everything else: "**Ordinary menus and popovers are nearly opaque
graphite with a restrained glass edge.**" The 2026-08-09 amendment draws the line by what a
surface hangs off — transient surfaces "standing over the reading on their own" are glass, and
the graphite recipe "stays the rule for an ordinary popover or menu — those **hang off a control
the reader clicked** rather than standing over the reading on their own."

The `/` picker hangs off the composer's own field, so it is a menu: graphite, restrained edge.
That is already what variant A is drawn in — it inherits the run-settings popover recipe #536
settled (`rgba(52,55,61,.78)` with a restrained rim), so **A is not glass-on-glass**. It is
graphite over glass, which is the sanctioned pattern.

**B is the variant that conflicts.** It renders the most transient content in the app — a 75-row
catalogue dismissed in two seconds — in the app's most expensive material, by extending the
vessel's own glass. That inverts D14's "transparency is earned by architectural or interaction
importance, not applied as a component-library default", and it makes a scrolling catalogue read
as a permanent part of the input surface.

Apple's guidance points the same way. [Materials](https://developer.apple.com/design/human-interface-guidelines/materials):
"Use Liquid Glass effects sparingly… Limit these effects to the most important functional
elements in your app." [Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass):
"avoid overcrowding or **layering Liquid Glass elements on top of each other**", and "Limit the
use of Liquid Glass effects onscreen at the same time." Menus are the system's anchored-list
component and adopt Liquid Glass automatically, so an anchored, long, scrollable list is a
standard shape — the house contract just spells that shape graphite.

**The counter-argument, recorded rather than dismissed:** SwiftUI's `GlassEffectContainer` with
`glassEffectID` exists so glass shapes can "blend their shapes together and morph in and out of
each other during transitions" — a vessel growing into a list is the material's signature move,
which is a real reading of B. D14 outranks it here, rationing that move to surfaces that stand
over the reading on their own.

**One caveat against A, named so it is not rediscovered.**
[HIG · Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) says to
use a popover for "a small amount of information or functionality… a few related tasks" and
"**Avoid making a popover too big.**" A ten-row filtering catalogue is not that. So it is built
and named as a **menu / completion list**, not a popover — which is how it behaves:
keyboard-first, filtering as you type, inserting text. Its full-vessel width stays earned,
because the description *is* the content.

Consequences for the implementation ticket: **no `.glassEffect` on this surface**, no
`GlassEffectContainer`, and the per-row origin badge is dropped in favour of A's section headers
— at rest the badge is a column of `PROJECT`. Variant C is the only one D14 would permit to be
glass, a palette over the deck being a "major transient surface", and it loses on interaction
anyway by taking the caret.

## The rename

`AttachButton` cannot survive this ticket. The control now opens files, skills and commands, and
two of those three are not attachments — a name that says `Attach` makes every later reader
expect a file picker behind it.

**`AddButton`** is the name, and its accessibility label is *Add to this turn*. It keeps the `+`
glyph the approved design froze, so nothing about the footer's drawing changes. The rejected
alternatives: `PlusButton` (names the glyph, not the job, and dies the moment the glyph changes)
and `ComposerMenuButton` (names the mechanism, and would have to change again if the menu ever
became a popover).

## What it is faithful to, and what it is not

Every colour, radius, spacing step and type role is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` — `GraphitePalette`, `ArgoGeometry`,
`ArgoLayout`, `ArgoTypography`. Type is San Francisco throughout: SF Pro for prose, SF Mono for
the names and paths, and the contract has no serif.

**One proposal against the contract:** the 26pt row. `ArgoGeometry` has no row-height rung, and
26 is what a mono name plus an 11pt description needs while keeping the to-do list's rhythm the
user named as the reference. If a variant is approved, that value goes through
`setup-design-foundations` or is derived from an existing rung — it is not a constant to copy
into a view.

The shell (full-height glass sidebar, transparent titlebar, scope vessel, Rooms), the roster row
and the whole composer are **lifted from #502 and #536 as context**, not redrawn. The Sessions
are the same real ones read off this machine, with only liveness and the
`managed | external | orphaned` posture assigned. The Codex Session that carries the `codex`
state is a genuinely spawned one, and the read-only and orphaned states sit on Sessions that are
really in that posture.

It is **not** a component structure, a state machine, or anything to port line-by-line. Settling
it is `prototype-to-design` then `design-to-code`, on #535's implementation tickets. This only
shows what those must produce.
