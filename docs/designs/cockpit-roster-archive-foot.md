# The roster's Archived foot

The design for the disclosure at the foot of the Sessions roster — the row reading `Archived (n)`
and the archived rows behind it. One surface, one control.

Subject: `RosterArchiveFoot` and `SessionNavigator.archivedFoot`
(`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Sidebar/`).
Behaviour lineage: `cockpit-spec.md` §4.1, and B5 in `cockpit-session-interior-decisions.md`.

**The two rules the built version broke**, kept here because they are what the design has to hold and
each is easy to break again:

1. **One chevron.** A sidebar `Section` given an `isExpanded:` binding draws the system's own
   disclosure in its header, revealed under the pointer. A header that also draws its own then
   carries two, and only the system's toggles.
2. **A chevron is quieter than its label.** See **The chevron rung** below; that half was never only
   this foot's.

## What Apple's guidance settles

Read from [Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls),
[Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) and
[Outline views](https://developer.apple.com/design/human-interface-guidelines/outline-views) on
2026-08-11.

- The control for this job is the **disclosure triangle**, not the disclosure button: a triangle
  "shows and hides information and functionality associated with a view or a list of items", where a
  button belongs to "a specific control". So the foot takes the triangle's grammar, and the
  button's one-per-view rule does not apply.
- A triangle "points inward from the leading edge when its content is hidden and down when its
  content is visible". That settles both the edge and the rotation, and the built version's leading
  chevron was in the right place — it was just the wrong number of chevrons.
- "Provide a descriptive label ... Make sure your labels indicate what is disclosed or hidden."
  `Archived (n)` is that label.
- Grouping in a sidebar is what disclosure is **for**: "Group hierarchy with disclosure controls if
  your app has a lot of content."
- A sidebar's "row height, text, and glyph size depend on its overall size", which the reader
  changes in General settings. So the measurements below are a **floor and a rhythm**, never a fixed
  height.

Two places this design knowingly departs from Apple:

- **"Avoid putting critical information or actions at the bottom of a sidebar. People often relocate
  a window in a way that hides its bottom edge."** The foot is kept, because `cockpit-spec.md` §4.1
  pins it there and what it holds is deliberately *not* critical — the roster above carries
  everything you act on. The archive is the look-back. If the foot ever holds an action, this line
  is the reason to move it.
- **"Retain people's expansion choices."** The foot is shut on launch instead, by story 15's
  reasoning: going back to an archived Session is deliberate, and a foot that reopened itself would
  put cleared rows back under the ones you kept.

HIG says clicking the **triangle** toggles it, and says nothing about the label. The whole-row target
below is this design's own call, and it is the behaviour of both SwiftUI's `DisclosureGroup` and
macOS's own sidebar section headers.

## The design

One chevron, at the leading edge, and **the whole header row is the control**.

```
┌─────────────────────────────────────────┐
│ ● Feed anchoring            running     │  ← last live roster row
│   20h ago                  ⌥ ticket-473 │
│                                         │  8   gap above the foot
│ ›  Archived (1)                         │  22  the whole row toggles
├─────────────────────────────────────────┤
│ ● General conversation                  │  ← archived rows, same insets
│   20h ago                                  as the rows above
└─────────────────────────────────────────┘
  12  6
   ↑  ↑ label
   chevron gutter
```

**Anatomy.** The chevron sits in a fixed 12pt (`ArgoSpacing.comfortable`) leading gutter, then
6pt (`ArgoSpacing.snug`) to the label, so the label's left edge does not move between the two
states. Vertical inset 4pt (`ArgoSpacing.tight`) over a 22pt **minimum** row height — a minimum and
not a frame, because macOS scales sidebar row height and glyph size with the reader's own sidebar
size setting, and a fixed height would refuse it. 8pt
(`ArgoSpacing.base`) above the header, which is what detaches the foot from the last live row —
there is no rule, no fill and no separator. The archived rows keep the roster row's own insets: they
are rows of the same kind, so nothing indents them.

**Ink and weight.** Label `ArgoTypography.caption`, chevron `ArgoIconSize.chevron`. Both
`text.tertiary` at rest and `text.secondary` while the pointer is over the row. That colour change
is the only hover feedback: the sidebar's system material owns the row grounds (D2, D3), so a
background wash here would read as a selection.

**The chevron rung, added for this and taken by every chevron in the app.** The mark was on
`ArgoIconSize.inline` (10pt), the rung for a mark that carries meaning of its own, and it outweighed
the caption it annotates. `ArgoIconSize.chevron` (8pt) is now its own rung, below the `inline` floor,
and it is the only rung allowed there. It is not just this foot: the toolbar's Project and branch
vessels and the feed rows that open onto evidence all draw the same mark, and all four were the same
size wrong. They now go through one component, `ArgoDisclosure`, which takes the direction it opens
and rotates. One symbol, because the scale holds a mark's HEIGHT — so `chevron.down` at a given rung
is half again as wide as `chevron.right` turned, which is why the down-chevrons read as the loudest
thing in the toolbar.

**No gear.** `cockpit-spec.md` §4.1 writes the foot as `⚙ Archived (n)`; the gear was never drawn
and is not adopted. The chevron is the one mark, because a second glyph is the defect this design
exists to remove.

**The label says what it opens.** `Archived (n)` — `SessionRosterProjection.archivedFoot` already
composes it, and the count is how many are behind the row.

**States.**

| State | Chevron | What is below |
|---|---|---|
| Nothing archived | — | The foot is absent entirely, header and all |
| Shut (launch, and whenever the archive comes back) | `ArgoDisclosure(.beside)`, 0° | Nothing |
| Open | `ArgoDisclosure(.below)`, rotated 90° | The archived rows |
| Pointer over the header | either, ink `text.secondary` over `ArgoMotion.stateChange` | Unchanged |

**Motion.** `ArgoMotion.reveal` (0.22s easeOut) drives the rotation and the rows arriving, one
animation over the open value so they move together. It sits on the whole `List`, because dropping
the section's `isExpanded:` gave up the system's own expansion — on the chevron alone, the rows
arrived in the click's frame. Under Reduce Motion the role runs at 0.10s linear, so the rotation is
quick rather than absent; it is not a fade, whatever the role's reduced arm does for opacity
elsewhere. The chevron must be **one symbol rotated**, not a second symbol swapped in — a swap
cannot animate, which is why the built version's state change was a jump.

**Gestures.** The header is a `Button`, so it is one click anywhere on its row. It never takes list
selection: it is not a Session, and a highlight on it would claim it was.

**Reached the way every other control is, which #718 later made the rule.** Under default macOS
settings the keyboard does not reach the foot: a `.plain` `Button` in a sidebar section header takes
no key focus until the reader turns Full Keyboard Access on. The route ruled out during the build was
`.focusable()` on the header, which would make a section header a Tab stop inside `List(selection:)` —
which Apple's own sidebar headers are not — and charge that cost to every reader who tabs the roster.
The older
[Disclosure Triangles guidance](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-24.html) gives ⌘→ /
⌘← for a disclosure and the current HIG is silent, so there is no convention to bind either.

That local call is now the cockpit's contract, in `rules/ui-components.md` under **How a control is
reached from the keyboard**: the foot is a real `Button`, so Full Keyboard Access reaches it and
VoiceOver reaches it with the setting off. It is not a gap to be patched here.

**Accessibility.** Label `"Archived, n Sessions"`; value `"Expanded"` / `"Collapsed"`; hint
`"Shows the Sessions you archived"`. The button trait comes from the `Button`. The archived rows
below stay their own elements, announced exactly as roster rows.

**The SwiftUI mechanic that removes the second chevron.** Do not pass `isExpanded:` to the
`Section`. With no binding the system draws no disclosure control of its own, and the section's
content is emitted conditionally from our own state:

```swift
Section {
    if isArchiveOpen { ForEach(archived) { swipeable($0) } }
} header: {
    RosterArchiveFoot(foot: foot, isShowing: isArchiveOpen, toggle: { ... })
}
```

## Rejected: the native hover-only control

Going fully native — drop the drawn chevron, keep `Section(isExpanded:)`, and let macOS reveal its
`Show`/`Hide` under the pointer — is one line of deletion and matches Finder exactly. It is rejected
because the archive is the one part of the roster nobody visits daily: a control that exists only
while the pointer is on it is a control nobody discovers. The built code already made that call in
its own words, and Apple's disclosure guidance agrees, since a mark whose angle reports state cannot
report anything while it is not drawn.

## Build checklist

Built, in `RosterArchiveFoot.swift` and `SessionNavigator.archivedFoot`:

1. `footHeader` became `RosterArchiveFoot`, a `Button` filling the row, with the rotation, the hover
   ink and the accessibility above.
2. `Section` lost its `isExpanded:` binding; the content is conditional.
3. Both the rows and the chevron read **one** binding (`SessionNavigator.isArchiveOpen`). The first
   render caught the alternative: with the reveal flag opening only the rows, the chevron still
   pointed shut, which is the exact failure the "angle is the state" rule exists to stop.
4. The two existing rules stand: shut on launch, and shut again whenever the archive is emptied and
   refilled (`SessionNavigator.onChange`).
5. `Specimen.openArchivedRoster` renders the open state, since a click cannot reach a screenshot.
   Both PNGs are in `renders/` as `roster-archive-shut.png` and `roster-archive-open.png`, with
   `toolbar-chevron-rung.png` as the evidence for the rung away from this surface.
6. `RosterArchiveE2ETests` is what proves the click, because no projection test can: it opens on the
   shut specimen and presses the label rather than the mark.
7. Every chevron went onto the rung, including the ones no `ArgoGlyph` call site owned:
   `ConnectPortRow`'s menu was drawing the system's indicator at the system's size, so it now hides
   it and draws `ArgoDisclosure` beside the menu the way `GitVessel` does.
