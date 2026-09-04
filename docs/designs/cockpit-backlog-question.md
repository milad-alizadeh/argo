<!-- status: approved
     approved-at: 3ed1c522
     prototype: worktree-ticket-1293-backlog-question -->

# A question asked of the backlog

The approved design for the **asking surface** (#1293) — the search field when it holds a
question, the affordance that offers the ask, the wait, and the sheet the answer draws on.

The backlog's search field matches a substring of the number and the title, and nothing else
(`cockpit-work-room.md`, **the two narrowings, decided**). That is a good field, and this design
does not touch it. What it adds is a second path for the question that field cannot answer: *is
there a ticket for this thing, and what state is it in?*

The prototype explored six shapes. This is **C** — the field that *finds* the question — with
**E**'s sheet as where the answer draws. The other five, every state they were judged in, and
the reasoning are on the throwaway branch `worktree-ticket-1293-backlog-question`, with the
notes in `docs/designs/prototypes/backlog-question-prototype.md`.

## Scope, and one warning

This file covers the asking surface **only**. The room around it in the HTML is drawn to what
the app **ships today**, not to `cockpit-work-room.html`.

> **`cockpit-work-room.html` is stale on this exact region.** It puts the two-line heading in
> the window's toolbar row (#836 moved it into the list pane), draws a Filter button (#900
> deleted the funnel) and a Mode chevron on Start (#1232), puts Next-up in the deck rather than
> the sidebar, and never draws a query at all (#873 added one). Re-basing it is #1304.
> Nothing here approves what that file currently says about the toolbar.

The room's own vocabulary — views, the backlog, the ticket, rails, the stated empty — is that
design's and is unchanged.

## Run it

```sh
open docs/designs/cockpit-backlog-question.html
```

`?state=<key>` opens one state directly, `←`/`→` walk them, and `?render=1` strips the chrome
for the PNGs in `backlog-question/`.

## The components

Names are frozen: they become component files and ticket titles.

| `data-component` | What it is |
|---|---|
| `BacklogSearchField` | the shipped field, amended — it widens and swaps its leading glyph while it holds a question |
| `BacklogAskAffordance` | the two-line offer under the field: Search on `⏎`, Ask on `⌘⏎` |
| `BacklogAskWait` | the pulse and its sentence, while a model reads |
| `BacklogAnswerSheet` | the sheet over the ticket pane |
| `BacklogAnswerCitation` | a number inside an answer — live, or dead where the room cannot find it |
| `BacklogAnswerAttribution` | who answered, what it read, what it cost |
| `BacklogAskVacancy` | the refusal where no Account can pay |

## The states

Every one is reachable by URL, because a state nobody can link to is a state nobody re-checks.

| `?state=` | What it settles |
|---|---|
| `rest` | the field untouched — the asking surface costs this state nothing |
| `term` | the plain path, unchanged: one result, two rails, the shipped behaviour |
| `found` | the ask offered, with Search still on the return key |
| `asking` | the wait, and what it must not do to the list |
| `answered` | where an answer draws and how it is attributed |
| `followed` | the one act that drops the query |
| `empty` | nothing matched, which is an answer and not a failure |
| `wrong` | a number the room cannot find |
| `unbound` | no Account can pay |
| `vacant` | no provider, so no list, so no question |

## The decisions

### The ask is found, never switched to

There is **no new control**. The row of controls stays one row, which is the rule the room
cannot break, and a reader who never notices this feature has lost nothing at all.

The field notices the text has stopped looking like a term and offers the ask underneath it.
**Search keeps `⏎`.** The ask takes `⌘⏎`. The default never moves, so a reader who types a
question and hits return gets the search they have always got — including its honest empty.

**Detection must be conservative, and it is the one thing the prototype could not settle.** A
short question reads as a term and a long term reads as a question; a leading glyph that
flickers while somebody types is worse than either mode alone. The rule the design assumes is
*ends in a question mark, or six words and up*, and it is written down here so the ticket that
implements it knows it is a proposal to test, not a measurement.

**The glyph changes once.** Magnifier to wand, at the moment the offer appears, and back only
when the text stops being a question. It never animates and never flickers within a word.

### The field widens, and only while it asks

`210 → 268`, over `ArgoMotion.stateChange`. 268 still clears the trailing edge at the 1280
window, which is the same arithmetic that set 210.

**The tail of the question stays visible**, not the head: the caret is at the tail, and a field
that showed you the part you are not editing is a field showing you the wrong half.

### The answer is prose, on a sheet over the ticket pane

Not the list pane — the list holds the tickets the reader asked about, and taking it costs them
the thing they were looking for. Not a popover — three sentences fill one at 360 and the answer
is regularly longer. The ticket pane already holds prose, and it is the pane a reader searching
the backlog has stopped reading.

**The cost is real:** the open ticket goes behind the sheet, so comparing the two means closing
one. That is the trade this design accepts.

**Rows are the follow-through, not the answer.** Pressing a citation selects the row. The
prototype's variant D made rows the whole answer and could only ever answer *which tickets* —
"what state is it in" has no rows.

### What the answer may read

Stated on the answer itself, never behind a disclosure:

> Read **12 open tickets** — number, title, labels, priority, type, status word and the
> `blockedBy` edges the room already holds. No ticket body, no comments, nothing you clicked.

That is exactly `TicketsRoomProjection.Room` — what the room has already fetched. More than the
plain field (the number and the title). Less than a Session (which can read a body).

**Bodies are out on purpose.** An answer that depends on which bodies happened to be cached is
an answer that changes between two readers of the same view. The listing is the same for
everyone, which is what makes the answer repeatable — and repeatable is the property that lets
anybody check it.

### The honesty tier does not fit, and this is the open question

The HTML draws the answer as **CONVENTION**, and that label should not survive review.

`docs/domain/honesty-tier.md` defines CONVENTION as *arrived over the companion-plugin/MCP
channel*. A backlog answer is none of the three:

- not **DIRECT** — Argo did not compute it;
- not **DERIVED** — nothing outside Argo asserted it, and a model is not an authority being read
  verbatim;
- not **CONVENTION** — nothing came over the plugin.

It is a fourth thing: **a model's reading of facts Argo already holds.** Either the tier
vocabulary grows a rung, or the doc states why this is CONVENTION. That is a domain decision and
an ADR, not a rendering one, and it blocks nothing else here — **because the badge is not what
does the work.**

Three things do:

1. **The answer never draws as the room's own prose.** It sits on a sheet with its own head, its
   own foot, and a rule between them.
2. **The room's words are refused.** The heading keeps saying `0 results` for the query, because
   that is the query's honest arithmetic. A question never produces a `results` count.
   `TicketsChromeProjection` builds `n results` from `narrowing.matches`, and a question must not
   reach that path.
3. **The foot names the Account and the elapsed time.** The plain field answers in a frame and
   says nothing. An answer that took 2.4 seconds and cost a model says so.

### A wrong answer, checked

**Every number an answer names is checked against the set the room holds.** One that is not
there draws as `BacklogAnswerCitation.dead` — struck through, not a link, not pressable — with a
stated notice under the prose. Nothing narrows and no row is drawn for it.

This is the most important guard in the design. A live-looking link to a ticket that does not
exist is worse than any empty state.

**The other failure is not drawable.** A model that misses a ticket that does exist leaves
nothing on screen to see. The only honest mitigation is the read line: a reader who knows it saw
all twelve knows a miss is a miss, not a gap in what was fetched.

`empty` is not a failure and is not drawn as one — nothing matched, said plainly, with the
nearest thing named.

### The wait

**The list is never cleared and never dimmed while a question runs.** It still holds the honest
answer to the query, and the question has not answered anything yet. A reader who asks something
and watches their tickets vanish has lost what they were looking at to an answer that has not
arrived.

The wait has a **Stop**. Anything past a frame that cannot be stopped is a hang.

### The query survives, except once

- Opening a question **does not clear the field**, and does not touch the list.
- A question is **not held**: it is not the Project's, it does not survive a room switch, and it
  never appears in the heading's second line. The heading keeps reading `view · grouping ·
  count`, in that order.
- **Following a citation drops the query**, and the field clears with it (`state=followed`). The
  answer names tickets the query had filtered out, so the list cannot honour `chart` and show
  `#336` at once. Something gives, and it is the query — with nothing left on screen claiming a
  narrowing that is not in force.

### Which Account pays

A **Binding** is a Project's use of one Account *through one port* (`CONTEXT.md` L1 · Binding).
The GitHub Binding on the Tickets port **reads tickets; it does not answer questions about
them.** Asking spends a model, which is a different port and normally a different Account.

The foot names both: the provider that was read, and the Account that paid. `state=unbound`
draws the case with no Account — the ask still opens, and what it opens is the refusal plus
`Connect an Account…`. A disabled affordance with a tooltip would be quieter and would teach the
reader nothing.

### The empty room

**The asking surface is a member of `narrows`**, the condition `TicketsChromeProjection.reading`
already computes (`hasRows || narrowing != nil`). No list, no question — there is nothing to ask
about. No new rule is needed, and `state=vacant` draws it: the vacancy replaces the deck, the
row of controls is gone, and the field goes with it.

## The measurements the tickets must carry

Surface measures, not tokens — per `rules/swift.md` they live beside the surface, not in
`ArgoDesign`.

| Measure | Value | Where it goes | Why |
|---|---|---|---|
| `askWidth` | `268` | `ArgoTicketsChrome` | the field while it holds a question; the widest that still clears the trailing edge at 1280 |
| affordance width | `= askWidth` | `BacklogAskAffordance` | it is the field's own footprint, so it aligns to the field rather than to the window |
| affordance row | `⏎` / `⌘⏎` | `BacklogAskAffordance` | Search keeps the default key |
| wait bar | `40 × 2` | `BacklogAskWait` | a bar, not a spinner: it sits inline in a sentence |
| sheet insets | `24 / 32` (`section` / `region`) | `BacklogAnswerSheet` | the ticket pane's own insets, because the sheet stands in for that pane |
| sheet rise | `ArgoMotion.stateChange` | `BacklogAnswerSheet` | 0.18s easeOut, exact |
| pulse | `ArgoMotion.working` | `BacklogAskWait` | the token for an indeterminate wait |

## The snap table

Every raw value the prototype held, and the token it landed on. **Nothing was promoted, so the
contract does not change.**

| Raw | Lands on | Snap or promote |
|---|---|---|
| every colour | `GraphitePalette` — already transcribed | snap, 1:1 |
| `rgba(0,0,0,.22)` answer ground, `.28` field well | `surface.sunken` | snap |
| `rgba(242,85,92,.07)` wrong-answer ground | `state.failure` at `ArgoTint.wash` (0.10) | snap |
| `rgba(242,85,92,.28)` its rim | **deleted** | the wash and the failure-ink line already say it |
| `rgba(62,155,255,.18)` 3px halo | `interaction.focusRing` at `ArgoStroke.focus` | snap |
| `.18s` ease-out | `ArgoMotion.stateChange` | snap, exact |
| `1.25s` linear repeat | `ArgoMotion.working` | snap — same role, and the token's period wins |
| `12 / 6 / 3` radii | `ArgoRadius.popover / control / marker` | snap |
| `2 / 4 / 6 / 8 / 12 / 16 / 24 / 32` | `ArgoSpacing` | snap |
| `10 / 11 / 12 / 13 / 15 / 17` | `ArgoTypeScale` | snap |
| `0.5 / 1 / 2` strokes | `ArgoStroke.hairline / border / focus` | snap |

## What the render does not show

- **The sidebar is Liquid Glass** in the app (D2/D3/D14). The HTML approximates it with a
  translucent column, because a browser has no vibrancy. If it reads flat here, that is this
  file's limit and not a proposal.
- **Detection cannot be judged from a still.** Whether the leading glyph is stable while somebody
  types is the one thing that decides this variant, and it needs a real keyboard. The ticket that
  builds the field should carry a rendering of the glyph's transition and a hand test, not a
  screenshot.
- **The prose is written, not generated.** It is there to show how long an answer is and how it
  reads. It does not promise what a model would say.
- **Latency is drawn at one value.** `2.4s` is plausible, not measured. What the design fixes is
  that the elapsed time is *stated*, not what it is.

## Next

`/to-tickets`, then `design-to-code` per ticket, then `/pixel-review` against the PNGs in
`backlog-question/`.

Two things are open before code:

1. **The tier.** An ADR, or a line in `docs/domain/honesty-tier.md` saying why a model's reading
   of Argo's own facts is CONVENTION.
2. **The detection rule.** Worth its own small study against a hundred real queries, because it
   is what decides whether this variant works at all.

And one is filed separately: **#1304 — re-base `cockpit-work-room.html`** against #836, #873,
#900, #1075, #1165, #1232 and #1243.
