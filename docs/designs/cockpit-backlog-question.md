<!-- status: reopened
     approved-at: 3ed1c522
     reopened-at: #1316
     prototype: worktree-ticket-1293-backlog-question -->

> **Reopened by #1316 — the glyph does not hold still.** The ticket that was meant to test
> "ends in `?`, or six words and up" against a realistic corpus (`BacklogQueryIntentCorpus`, 106
> queries in `apps/macOS/Packages/ArgoUI/Tests/ArgoUITests/`) found both risks this file names
> below. A long term reads as a question: `19/106` — roughly one term in six, every one a pasted
> title or a long plain phrase — is misread. A short question reads as a term: `2/106` carry no
> mark and fall under six words, and the rule misses them outright. The leading glyph also
> changes its mind at least once on the way to being typed for `51/106` queries — three of those
> (an embedded `?` inside a URL query string) flip it twice. `docs/designs/cockpit-backlog-
> question.html?variant=B` — the wand at the field's edge, on `worktree-ticket-1293-backlog-
> question` — is the drawn fallback this file names as the alternative to variant C. The evidence
> is `BacklogQueryIntentProjectionTests.swift` in that same test target.

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

> **`cockpit-work-room.html` is stale on this exact region, and #1242 widened the gap.** It draws
> one window-wide row of controls; the app now gives every pane its own band inside the window's
> strip. It draws a Filter button (#900 deleted the funnel), a Mode chevron on Start (#1232), and
> the two link verbs (#1242 cut them — the ticket's number is the link). It puts the two-line
> heading in that row (#836 moved it into the pane) and Next-up in the deck (it is in the
> sidebar). It never draws a query at all (#873 added one). Re-basing it is #1304, and this
> design's own chrome was corrected against `ARGO_SPECIMEN=ticketsRoom` after #1242 landed.
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
| `BacklogSearchField` | the shipped field, amended — it widens and swaps its leading glyph while it holds a question. It stays at the list pane's trailing edge on `BacklogPaneHeader`, at `ArgoControlBox.vessel` tall |
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

There is **no new control**. The list pane's band keeps exactly what #1242 put on it — New
ticket at the leading edge, the field at the trailing one — and the asking surface adds nothing
beside them. A reader who never notices this feature has lost nothing at all.

That argument got *stronger* under #1242, not weaker. The band is now scoped to one pane and
holds almost nothing, so the room's rule is sharper than "one row": **a control sits at the
leading edge of the pane it acts on, a field at the trailing edge of the pane it searches.** A
wand would have had to be a second mark on a band that deliberately carries one.

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

`210 → 268`, over `ArgoMotion.stateChange`.

**268 is derived at the list pane's FLOOR, not at the 1280 window.** #1242 moved the field out of
the window's row and onto the list pane's own band, so the edge it has to clear is the pane's,
and the pane is draggable. The binding case is `ArgoLayout.backlogWidths.lowerBound`:

```
342   ArgoLayout.backlogWidths.lowerBound — 960 − 280 − 320 − 9×2
− 12  the band's leading inset (ArgoBacklogList.bandInsetX)
− 36  New ticket's vessel (ArgoControlBox.vessel)
−  8  the minimum gap between them (ArgoSpacing.base)
− 12  the band's trailing inset
─────
274   and the field asks for 268, with 6 to spare
```

Six points of margin is thin, so the rule is **`min(268, what the pane affords)`** rather than a
flat 268. Below the floor there is no pane to afford anything, and above it nothing more is
wanted: a field wider than 268 is a field a reader stops reading as a field.

**The tail of the question stays visible**, not the head: the caret is at the tail, and a field
that showed you the part you are not editing is a field showing you the wrong half.

**The field is `ArgoControlBox.vessel` tall (36), not a 28 of its own.** #1242 made that true for
the shipped field — a field is a container on this band like any other, and its own height made
the band three heights of container.

### The answer is prose, on a sheet over the ticket pane

Not the list pane — the list holds the tickets the reader asked about, and taking it costs them
the thing they were looking for. Not a popover — three sentences fill one at 360 and the answer
is regularly longer. The ticket pane already holds prose, and it is the pane a reader searching
the backlog has stopped reading.

**The sheet covers the pane's content, never its band.** #1242 put the ticket's verbs on that
band, so a sheet drawn over the whole pane would take `Start` away in order to show you a ticket
you cannot start. The band stands and the answer sits under it.

**The cost is real:** the open ticket's body goes behind the sheet, so comparing the two means
closing one. That is the trade this design accepts.

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
| `askWidth` | `min(268, pane affords)` | `ArgoTicketsChrome` | the field while it holds a question; 268 is what fits beside New ticket at the list pane's floor of 342, with 6 to spare |
| affordance width | `= the field's` | `BacklogAskAffordance` | it is the field's own footprint, so it aligns to the field and moves with the pane's seam, never to the window |
| affordance row | `⏎` / `⌘⏎` | `BacklogAskAffordance` | Search keeps the default key |
| wait bar | `40 × 2` | `BacklogAskWait` | a bar, not a spinner: it sits inline in a sentence |
| sheet insets | `24 / 32` (`section` / `region`) | `BacklogAnswerSheet` | the ticket pane's own insets, because the sheet stands in for that pane's content |
| sheet's top edge | under `TicketsPaneHeader` | `BacklogAnswerSheet` | the band stays, so `Start` is never covered by an answer |
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

## What #1242 changed, and what survived it

This design was approved against the room before #1242 (#1302) and re-based onto it. Recorded
because a reader coming from the PR will see both.

**Changed:**

- The window-wide row of controls is gone. Three per-pane bands, drawn *inside* the window's
  strip, so no pane loses a line. The design's chrome was redrawn.
- `askWidth`'s derivation is completely different: the field's trailing edge is the list pane's,
  not the window's. The number came out at 268 again, from arithmetic that shares no term with
  the old one.
- The field is `ArgoControlBox.vessel` (36) tall, not 28.
- The sheet stops at the ticket pane's band instead of covering the pane, so `Start` survives an
  open answer.
- The ticket's number draws as the link, so the ticket detail's `#272` is accent-coloured here.

**Survived unchanged:** every decision about the asking surface itself — found not switched to,
Search keeps `⏎`, prose on a sheet, the read line, the dead citation, the refused `results`
count, the query rule, which Account pays, and the `narrows` gate on the empty room.

That is the useful result of the re-base: **#1242 moved everything around this surface and
nothing inside it.** The one argument it strengthened is the case against a wand — the band it
would have sat on now deliberately carries one control.

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
