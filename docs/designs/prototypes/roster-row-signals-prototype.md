# Prototype — roster row signals: Agents, pull request, ready to ship

**Throwaway.** Lives on `argo/#1310-roster-agent-count`, not on `main`.
Open `roster-row-signals-prototype.html` beside it; switch with the floating bar, `←` / `→`,
or `?variant=A|B|C|D`.

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
3. **That the Session is ready to ship**, and the action that ships it — a **Create PR** control
   that runs `/ship` in that Session.

A variant here is a **position on how many of those three a dense row can carry, and where** —
not a skin. Each one gives something up, and the comment above each variant in the HTML says
what.

The row's existing slots are the constraint: leading dot, title, a second line with the activity
sentence, and the clock at the trailing edge (`SessionRosterProjection+Row.swift`,
`+Activity.swift`, `SessionRow.swift`). Nothing here may take the activity's slot or the clock's
without saying so.

## The four variants

| | Name | Count shape | PR | Ready to ship | Gives up |
|---|---|---|---|---|---|
| **A** | Pips in the leading column | one pip per Agent under the state dot, ceiling 3 + a bar | leading edge of line 2 | the state-word slot; a **Create PR** button on the selected row | the exact figure above 3, and line-2 width |
| **B** | Trailing meta column | labelled figure, no ceiling | filled chip, line 1 trailing | a **third line** the row grows, with the reason the Session gave | title width, and a uniform row height |
| **C** | Second line is a fact bar | labelled figure in a chip bar | second chip in the bar | the bar is replaced whole by the ship strip | the activity sentence — the one thing #1199 put there |
| **D** | One trailing gutter, one ranked fact | labelled figure, but only when it wins the slot | third in the ranking | wins the gutter outright, as a mini button | seeing two of the three facts at once |

The prototype renders the **answers card** beside the roster: every variant's position on each
of the ticket's eight questions plus the three the PR and the ship claim add. Nothing has to be
held in the reader's head.

## What the fixtures force

Each row exists to make a variant answer something:

- **3 running Agents, PR open** — the ordinary case.
- **12 running** — question 5, the ceiling. A row cannot draw 12 marks.
- **Delegated nothing** vs **delegated 5, all landed** — question 4. Two different facts, and
  one of them may want no mark at all.
- **An external Session** — question 6. The count is DERIVED and Argo cannot resolve it
  (#1076), so the shape needs a state that is not a number. Every variant draws an outline or a
  `?`, never a figure. `finished` there would be the #1269 untruth.
- **Ready to ship with no PR** — the strip and the button.
- **Ready to ship with a PR already open** — the stale claim. The claim is CONVENTION, arriving
  over the companion channel; the PR is DERIVED from the code host. **The PR wins and the strip
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
- **B's and C's fold tallies pile up three near-identical glyphs** (`⑂6 ⑂2 ⑂1`). A fold needs one
  summed fact, not three.
- **The delegate glyph and the PR glyph look alike at 11px.** Both are node-and-branch marks. If
  two of these facts ship on one row they need shapes that differ at a glance, not two forks.
- **D aligns the clocks into a column**, which is better than the row has today — but the fact
  under each clock changes from row to row, so the second column reads as a mixed bag.
- **Motion is wrong.** The switcher has a **Motion** toggle that breathes the marks. Turn it on
  once: nine rows pulsing out of phase is a list nobody can scan. Question 8 answers itself.

## The open risk, all four variants

**The PR inks are not in the visual contract.** `GraphitePalette.swift` has no purple at all, and
`--pr-open` (`#3FB950`) sits one hue from `--running` (`#46D3A8`) — the ink the state dot spends
on a Session that is working. A green PR number beside a teal running dot is **two greens on one
row saying two unrelated things**.

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
reading of it and the wiring behind **Create PR** that runs `/ship`. Filed separately; this
prototype only decides what the row looks like when the claim arrives.

`ship()` in the HTML is a stub that prints what it would do. No mutation is wired, by the
prototype rules.

## Related

- #1310 — the ticket this answers.
- #1269 — the rail read `0 running` while the Subagents wrote. A roster indicator repeats that
  error on every row.
- #1261 — running Sessions drew the grey dot in the roster.
- #1076 — the record alone cannot close a delegation.
- #1199 — why the second line carries the activity, and why the clock sits where it does.
