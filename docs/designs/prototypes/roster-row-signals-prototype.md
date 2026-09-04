# Prototype — roster row signals: Agents, pull request, ready to ship

**Throwaway.** Lives on `argo/#1310-roster-agent-count`, not on `main`.
Open `roster-row-signals-prototype.html` beside it; switch with the floating bar, `←` / `→`,
or `?variant=A|B|C|D|E|F`.

## The question

The roster row says what one Session is **doing**. It says nothing about the machinery under it
or the product coming out of it. Three facts want in at once, and they compete for the same two
lines and the same 320 points:

1. **How many Agents run under the Session right now** (#1310). The count exists —
   `FeedAgents.running(of:)` — but only inside the room, so the surface a reader uses to pick a
   room is the one surface that withholds it.
2. **Which pull request the Session is attached to, and its state.** Merged purple, open green,
   closed red — the code host's own inks, because the domain says a code-host fact keeps the
   host's vocabulary.
3. **That the Session is ready to ship** — drawn on the row as a **state**, never as a control.

A variant here is a **position on how many of those three a dense row can carry, and where** —
not a skin. Each one gives something up, and the comment above each variant in the HTML says
what.

The row's existing slots are the constraint: leading dot, title, a second line with the activity
sentence, and the clock at the trailing edge (`SessionRosterProjection+Row.swift`,
`+Activity.swift`, `SessionRow.swift`).

**Two rules hold across all four variants, and neither is negotiable.**

1. **The activity line stays.** What the Session is doing right now is the row's own subject
   (#1199). Every fact here is an addition to it, never a replacement for it. A variant that
   moved the activity to a tooltip was not a cheaper row — it was a different surface, and it
   is gone.
2. **No control on the row.** The roster has exactly one click and it selects the Session.
   Ready-to-ship is drawn the way `Needs input` is: a **word in the state slot**. The **Create
   PR** control that runs `/ship` lives in the **deck header**, where the Session is already
   open.

## The four variants

| | Name | Count shape | PR | Gives up |
|---|---|---|---|---|
| **A** | Pips in the leading column | one pip per Agent under the state dot, ceiling 3 + a bar | leading edge of line 2 | the exact figure above 3, and line-2 width |
| **B** | Trailing meta column on line 1 | labelled figure, no ceiling | filled chip beside it | the title's width — the widest thing on the row |
| **C** | Grouped with the clock, line 2 trailing | labelled figure in the trailing group | between the count and the clock | the activity's tail, and three facts where the eye expects one |
| **D** | One trailing gutter, one ranked fact | labelled figure, but only when it wins the slot | second in the ranking | seeing the count and the PR at once |
| **E** | A third line, only when there is a delivery | figure on line 1 trailing | on line 3, after the lifecycle track | a uniform row height |
| **F** | A third line on every row | as E | as E | about a third of the roster's vertical space |

In A to D, ready-to-ship is the word `Ready` in the state slot on line 1.

### E and F — the third line

E and F split the row by **subject** rather than by slot, which is the argument for a third line
at all:

```
line 1   who this is, and what machinery is under it   — title, agent count, state
line 2   what it is doing at this second               — activity, clock
line 3   what it has produced                          — the Delivery
```

Lines 1 and 2 are the **Session**: a process, running now. Line 3 is the **Delivery**: a product
on a branch that outlives the process. Nothing on line 3 competes with the activity, because the
activity is a different subject and now has a line to itself. The register change carries the
split — the utility face, one step down, the PR's own ink — so no hairline rule is needed. A
rule inside a row inside a list is furniture; a change of voice is not.

**The line leads with the Delivery's own lifecycle.** Five segments for `commits · pr · ci ·
review · merge`, the nodes `CONTEXT.md` L4 already names, filled to where the work actually got.
That is a structural device that encodes something true rather than decorating: the reader can
see at a glance that one run is at review and another has not opened a PR. A closed PR draws its
reached segments **hollow**, because filling them solid would say the work landed.

**Ready-to-ship needs no badge in this shape.** It *is* a filled `commits` beside an empty `pr`
— the gap is the state. The words beside the track say it in full, with the reason the Session
gave.

E draws the line **only where there is a Delivery**, so most rows stay two lines and the
*presence* of a third line is itself the signal. F draws it on every row, so the Delivery sits on
one x down the whole list.

**Line 2 disappears when there is no activity**, in both. A quiet Session with a Delivery would
otherwise draw a line holding nothing but a clock, and a hollow line between two full ones is the
one thing a three-line row cannot afford. The clock moves to the trailing edge of line 3, which
does not break the scan column: the clock is right-aligned to the row's edge on either line, so
only its *y* changes.

The prototype renders the **answers card** beside the roster: every variant's position on each
of the ticket's eight questions plus the two the PR badge and the ready state add. Nothing has
to be held in the reader's head.

## What the fixtures force

**The titles are the real shape.** A Session titled from its Ticket leads with the number —
`#1269 — The rail reads …` — exactly as the app draws it. The first fixtures used short invented
titles, and they hid two things that change the judgement. Titles are **long**, so every variant
that spends line 1's width costs more than it looked; and the meta slot is **empty** on most
rows, which is the projection's own rule (`toldApart` gives the Ticket only where the title does
not already name it, #1072).

Each row exists to make a variant answer something:

- **3 running Agents, PR open** — the ordinary case.
- **12 running** — question 5, the ceiling. A row cannot draw 12 marks.
- **Delegated nothing** vs **delegated 5, all landed** — question 4. Two different facts, and
  one of them may want no mark at all.
- **An external Session** — question 6. The count is DERIVED and Argo cannot resolve it
  (#1076), so the shape needs a state that is not a number. Every variant draws an outline or a
  `?`, never a figure. `finished` there would be the #1269 untruth.
- **Ready to ship with no PR** — the `Ready` word on the row (E and F: an empty `pr` node), and
  the control in the deck header.
- **Ready to ship with a PR already open** — the stale claim. The claim is CONVENTION, arriving
  over the companion channel; the PR is DERIVED from the code host. **The PR wins and the word
  never draws**, in all four variants.
- **A fold of 4 runs** — question 7. Every fact on a fold is a sum or it is a claim about runs
  it is hiding.

The deck beside the roster draws the same Session's Agents rail, so the roster figure can be
read against the rail's own `Background Agents · N running` line. #1269 says the two must never
disagree.

## What the pixels already settled

Rendered and looked at, all four:

- **A's pips do not read as a count.** Three running and twelve running draw almost the same
  stack. A pip stack answers "is work fanned out"; it does not answer "how many".
- **A landed delegation must not look like an Agent.** The first draft drew it as an outlined
  pip, which read as a fourth Agent and collided with the outline that means *unknown*. It is a
  dash now.
- **B's filled PR chips turn the roster into a wall of pills** — nine rows, nine coloured
  capsules, and the state dot stops being the first thing the eye finds.
- **A variant that took the activity line away had to go.** The first draft of C moved the
  activity to the title's tooltip to free line 2. It read beautifully and it answered the wrong
  question: the roster is scanned to find out what is happening, and a row that only carries
  delivery facts is a delivery list.
- **The row carries no button.** The first draft put **Create PR** on the ready row. A control
  on a row gives the roster a second click target, and every row then has to be aimed at rather
  than picked. The claim is a state; the action belongs to the open Session.
- **B's and C's fold tallies pile up three near-identical glyphs** (`⑂6 ⑂2 ⑂1`). A fold needs one
  summed fact, not three.
- **The delegate glyph and the PR glyph look alike at 11px.** Both are node-and-branch marks. If
  two of these facts ship on one row they need shapes that differ at a glance, not two forks.
- **D aligns the clocks into a column**, which is better than the row has today — but the fact
  under each clock changes from row to row, so the second column reads as a mixed bag.
- **C's trailing group gets crowded** at three facts (`⑂0 #1279 3d`), and the count and the PR
  are the two that a reader has to tell apart there.
- **Motion is wrong.** The switcher has a **Motion** toggle that breathes the marks. Turn it on
  once: nine rows pulsing out of phase is a list nobody can scan. Question 8 answers itself.

- **F barely differs from E on a real roster.** Nearly every Session has a Delivery, so F's
  extra line lands on one row in ten and says `no delivery yet`. F is the honest counter-position
  and the pixels do not support it.

## Two numbers, one row

**A pull request must never be addressed `#1312` on this roster.** The title already opens with
the Ticket number, so `#1269 — The rail reads …` above `#1312 open` reads as one run against two
tickets. Tickets and pull requests live in different spaces and the row has to say which one it
is addressing.

The prototype draws it `PR 1312`, and drops the word where a glyph is already carrying it. This
is the one finding here that is not a preference: it is a misreading, and it appears on every
variant that draws a PR number at all.

## The open risk, all six variants

**The PR inks are not in the visual contract.** `GraphitePalette.swift` has no purple at all, and
`--pr-open` (`#3FB950`) sits one hue from `--running` (`#46D3A8`) — the ink the state dot spends
on a Session that is working. A green PR number beside a teal running dot is **two greens on one
row saying two unrelated things** — and on a running row with a live Turn clock it is **three**,
because `RosterTurnClock` spends the running ink on the duration too.

The prototype draws it the risky way on purpose so the collision is visible rather than argued
about. Three ways out, and this is the decision the review has to make:

1. Take the host's colours and change the running dot. Expensive — the running ink is everywhere.
2. Keep only **merged** as a colour. Open and closed are drawn by glyph and position; purple is
   the only new ink, and it collides with nothing.
3. Give the PR no colour at all on the roster, and keep the state in the deck header.

## What this prototype does not build

The **ready-to-ship claim has no source yet**. `CompanionTool.swift` gives a managed Session
three things it may tell Argo — `report_status`, `ask_user`, `report_outcome` — and none of them
says "I am done, open the PR". That is a fourth tool, at the CONVENTION tier, plus the feed's
reading of it and the wiring behind **Create PR** that runs `/ship`. Filed as #1335; this
prototype only decides what the surfaces look like when the claim arrives.

`ship()` in the HTML is a stub that prints what it would do. No mutation is wired, by the
prototype rules.

## Related

- #1310 — the ticket this answers.
- #1269 — the rail read `0 running` while the Subagents wrote. A roster indicator repeats that
  error on every row.
- #1261 — running Sessions drew the grey dot in the roster.
- #1076 — the record alone cannot close a delegation.
- #1199 — why the second line carries the activity, and why the clock sits where it does.
- #1335 — the companion report behind the ready state, and the action behind **Create PR**.
