# Every pane carries its own header — throwaway prototype (#1242)

**A primary source, not a starting point.** Written under prototype constraints — no tests, no
abstractions, one file. The validated decision belongs in `cockpit-work-room.md`, not here.

## Run it

```sh
open docs/designs/prototypes/ticket-verbs-prototype.html
```

No build, no server, no dependencies.

## The question, and where it landed

*Where do the open ticket's verbs go, once they leave the window's one toolbar row?*

Every placement that kept the verbs in a **window-wide** row failed the same way, because the
row is measured off the window's trailing edge and the ticket pane's leading edge is measured
off a seam the reader can drag. Two independent numbers coincide by luck. That is what #816 and
#836 each learned once, and what this study measured again: a window-row cluster sat `+42` inside
the pane at 1280 with the seam at rest, and `−116` at every floor.

**So the row goes.** Each pane draws its **own** header, and the three sit on one band at the
height the window already spends on its title strip:

- the header **belongs to its pane** — its ground and its own column inset. It does not float
  above the pane, and it is not one continuous strip with the panes hidden behind it.
- **controls sit at their pane's leading edge.** Search sits at the trailing edge of the pane
  it searches, which is the list.
- **no rule under the header.** These panes are liquid-glass containers, and a container's own
  edge is what separates the band from what is under it. A hairline there draws a second edge
  inside the material's — the mistake `ArgoElevation.vessel` already refuses.
- the ticket's verbs are in the ticket pane's header, so they are over the ticket at every
  width **by construction**.
- it costs no pane a line. #836's band cost 44pt because it was drawn UNDER the strip.

## What it costs, and this is the real trade

The row stops being `ToolbarItem`s. The panes already run under the title strip — `DeckCanopy`
does it today with `reach: window.safeAreaInsets.top` — so this is drawable, but **the search
field, the menus and the drag region become the app's to place**, and the traffic lights' zone has
to be kept clear in the sidebar. `.principal` stays closed for `ShellToolbar`'s existing reason.
Nothing here is free.

The sidebar keeps `.navigation`: the Project scope is the WINDOW's, and it is already drawn over
the sidebar. Only the deck's two panes stop being toolbar items.

## The controls, after the cuts

### In the ticket pane's header — one pill

**`▶ Start` + `/implement ▾`, in ONE capsule.** Not two controls beside each other: the pill is
the control, and the two are its segments at `ArgoSpacing.hair`. Inside it `Start` draws no ground
of its own — the capsule IS the ground, and a second fill inside it would be an edge within an
edge. It answers the pointer on the neutral control ground, not in accent.

The command is a machine fact, so it stays in the machine face — and **the token is the picker**,
because the thing you read should be the thing you press to change.

**`#607` is the address**, drawn in `interaction.accent` as a link on the id line. `open on host`
and `copy link` are gone: they were two unlabelled marks for what the number already says, and
copy is the browser's own gesture on a link.

### In the list pane's header

**One control and a field.** The compose mark — `ArgoSymbol.newTicket`, which is
`square.and.pencil` — in a **circular** liquid-glass container of its own, and the search field
at the pane's trailing edge.

**The ordering menu is gone.** It offered one row, `Group by priority`, which is not a choice; it
is the funnel's fault (#900) wearing an ellipsis. It comes back the day a port reads a second
thing to group by, which is what #388 is for.

### The geometry, off PR #1259 (#1243)

Both controls are measured by `ArgoControlBox`, so the lone mark in a container stands exactly as
tall as the capsule holding two:

| | |
|---|---|
| `ArgoControlBox.icon` | **26**, a square |
| `vesselInset` | **5** — the VESSEL's padding, not the button's |
| `vesselGap` | `ArgoSpacing.hair` 2 — segments of one control |
| `vessel` | **36**, DERIVED (`icon + inset * 2`). Nothing sets it by hand |
| the search field | 210 × 28 — shorter, because it holds a line of type where they hold a mark |

A lone mark in `ArgoIconButtonGroup` is therefore a **36pt circle**, the same height as the Start
pill beside it. That is the whole point of that PR, and it is why this prototype depends on it.

### The skill picker

The menu names the default and why it matched, lists the other skills, offers a **Fresh
Session** with no command, and states in the menu itself that the Session carries `#607` as its
ticket whichever one runs — so the agent has the ticket in context for `/grill-me`, `/triage`
or anything else.

**This reopens the neighbourhood of a settled decision.** `cockpit-work-room.md` says
"**`Start` starts — there is no rung to choose**", and #872 deleted the chevron. That was about
Mode *rungs*, not about *which skill* — a different question — but close enough that the design
doc has to say so, or the next reader cannot tell the reversal from a regression.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?v=H\|E\|0` | `H` pane headers · `E` in the pane on the strip's hairline · `0` today. Also `←`/`→`. |
| `&form=line\|capsule` | the one pill, or the toolbar's glass capsule transplanted. |
| `&ink=primary\|quiet` | Start filled in accent, or on the neutral control ground. **`quiet` is the pick.** |
| `&menu=shut\|open` | the skill picker, open. |
| `&w=1280\|960` · `&seam=rest\|floor` | at 960 the list is clamped, so the narrowest window IS the seam's floor. |
| `&cmd=/implement\|/design-to-code\|` | `/design-to-code` is the longest; empty is the ticket that asks for none. |
| `&empty=0\|1` | a ticket open, or none. The header keeps its band and loses its verbs. |

## The alignment rule, and how it is held

> Every visible **edge** in a pane starts on that pane's leading inset and stops on its trailing
> one — a rule, a filled ground, a header. Type sits on the same two lines. A glyph inside a
> ground is inboard by that ground's own padding; that is the ground's business.

A control that carries **its own container** is judged by the container's edge, not its glyph.
That is why the compose circle's box lands on the list's 16, and its mark sits 5 inboard of that.

The bar's **`check alignment`** button re-proves the rule in the page and prints the deltas, so
the next edit is checked rather than eyeballed. Current reading:

```
1280                            960, /design-to-code
title / strip / #607 / verbs      Δleft 0.0          (both)
list control   Δleft 0.0          its container is 36.0 x 36.0
list search    Δright 0.0
header heights 52, 52, 52  (agree)
```

### What it caught, all measured, none by eye

| | |
|---|---|
| the fixed band's rule ran the whole **pane**; the fact strip's ran the **column** | 861→1339 vs 885→1315 |
| the command token wrapped at the 320 floor | `/design-to-code` broke to two lines, chevron off the baseline |
| the id line's trailing glyphs overhung the column | 8px at rest, 36px at the floor |
| beside the title, the title shredded at the floor | one word per line, control over it |
| a window-row cluster only sits over the pane when the pane is wide | over by +42 at 1280 rest; **−116 at every floor** |
| the rooms picker clipped `Code` when it shared the band with the lights | 78 + 8 + ~224 > 280 |
| the probe itself lied about the list control | it Ranged a glyph, and an SVG has no text node — measure the box |

## The answer

**`H`, `form=line`, `ink=quiet`.** Every pane carries its own header, on one band at the title
strip's height; the ticket's verbs are one quiet pill at the ticket pane's leading edge; the list
keeps a compose circle and its search field; the window's row for this room is gone.

Landed in `cockpit-work-room.md` under **the toolbar** and **the column question**.
