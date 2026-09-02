# Atlas · where each piece of information lives

`atlas-shell.html` — a **throwaway layout prototype**, not the map. Open it and switch with the
bar at the bottom, or `?shell=a|b|c`. The isometric field underneath is a cheap stand-in with
real domain names and real clicking, because a grey rectangle makes a layout impossible to judge.

## The question

`atlas-holo.html` accreted. Search, the domain index, the ranked list, the note list, the file
details and the encoding controls were each added where there was room, so the surface has no
system — and two failures follow directly from having none:

- A **domain's description reads inside the file details**, because the file panel was the only
  place a domain was ever mentioned.
- **Changing the domain selection rebuilds the whole list** it is selected in, because the panel
  is one string of HTML that gets thrown away and rewritten for every state.

Neither is a bug in a feature. They are what happens when the rule for placing a fact is "wherever
it fitted last time".

## The one rule all three answers keep

Every shell below is built from the *same* pieces — `Provenance`, `Encoding`, `Grouping`,
`Filters`, `Legend`, `Search`, `DomainList`, `FileList`, `DomainBody`, `FileBody`. A piece never
changes appearance between shells; only where the shell puts it changes. That is the point: the
choice is an **arrangement**, not seventeen small styling decisions.

Three separations hold in all three, and they are what fixes the two failures:

1. **A control is not information.** Area, height, colour, grouping and filters are one group
   that never mixes with content.
2. **A domain is a thing, with its own page.** Its note lives there. A file *cites* its domain as
   a clickable chip and never restates the note.
3. **A list and a detail are different regions.** Selecting inside a list must never be the thing
   that destroys the list.

## The three

### A · Two rails (`?shell=a`)

Left rail is **the question you are asking of the map**: provenance, search, filters, encoding,
legend. Right rail is **the answer you are pointing at**, and it is a browser with a visible
stack — `Atlas › Permission Gate › PermissionView.swift`. Every crumb is a link, so there is
never a hidden way back and no Back button to invent.

The left rail never reacts to a selection; the right rail never holds a control. Search replaces
the browse root with `Atlas › 118 matches`, so a search is a *level*, not a mode.

- **For it**: unambiguous. Two questions, two places, one visible path.
- **Against it**: 636 px of chrome. The map is the smallest it will ever be, and the left rail
  runs out of things to say long before it runs out of height.

### B · Dock + index (`?shell=b`)

Controls are not information, so they leave the rail entirely and live on a **dock over the map**,
where the thing they change is. The rail is then all content, split once and never again: the
**index** on top always shows a list (domains, or a search's results, or a domain's files), the
**inspector** below always shows the one selected thing.

Nothing ever replaces anything, so there is no Back and nothing to navigate. This is the shell
that most directly kills both original failures.

- **For it**: you can read a domain's note and still see the list you picked it from. Widest map
  of the three that still keeps a permanent index.
- **Against it**: a fixed 46% split wastes space when the inspector holds four numbers, and
  crowds it when it holds a note plus a file list. The dock also sits over the map's lower edge.

### C · Command (`?shell=c`)

The map takes the whole window. One command bar is the single entry to everything — it searches
files and jumps to domains in the same result list. The domain index is a **drawer** you can shut.
A selection opens a **card at the box itself**, so the eye never leaves the thing it clicked.
Encoding is a popover.

- **For it**: by far the largest map, and the only one where selecting does not make you look
  somewhere else. Scales to a much bigger repo.
- **Against it**: everything is summoned, so nothing is discoverable. A first-time reader sees a
  map, a search box, and no evidence that domains exist until they open a drawer.

## What I would take

**B for the system, C for the map.** B's two permanent regions are the actual fix — they are why
a domain note has a home and why a selection cannot destroy a list. C's card and full-bleed stage
are the better *reading* of a map, and its drawer says the index is optional, which it is.

The composite worth building: B's dock and its index-over-inspector rail, but the rail
**collapsible** the way C's drawer is, and the inspector **sized to its content** rather than
pinned at 46%.

## Verified

Rendered in Chrome at 1760×1120, all three shells, `errors: none`.

- A: crumb reads `Atlas › Permission Gate › PermissionView.swift`; the domain note does **not**
  appear in the file panel (`A leak: clean`); search rewrites the crumb to `Atlas › 118 matches`.
- B: with a file selected, the index is still populated **and** the inspector shows the file —
  both regions alive at once.
- C: the card lands 18 px from the selected box's own screen point, not where the last frame
  left it; the palette lists matching domains above matching files.
- 1,010 boxes drawn, 17 domain plates under Regroup, labels drawn only where the plate is wide
  enough to hold the word.

## Not answered here

Transitions. Every shell renders synchronously so the arrangement can be judged on its own; the
morph and crossfade rules already settled in `atlas-holo.md` are unchanged by any of this.
