<!-- status: approved
     prototype: argo/#1310-roster-agent-count -->

# The Sessions roster row

**Approved design** (#1310). The explorable is [`cockpit-roster-row.html`](cockpit-roster-row.html)
— every state reachable by `?state=`, `?state=all` for the whole set. The renders in
[`roster-row/`](roster-row/) are the spec, and `pixel-review` judges against them.

The variants this was chosen from are on the throwaway branch `argo/#1310-roster-agent-count`,
in `docs/designs/prototypes/roster-row-signals-prototype.html`. Nine were explored; **G** won.

## What the row says now

The roster row said what one Session is *doing*, and nothing about the machinery under it or the
product coming out of it. It now reads top to bottom as three questions a person asks in that
order:

```
●  Fix the worktree naming guard                          ← which run is this
∙    Ran scripts/swift-boundaries.sh                       ← what is it doing
∙    1m 30s  ▰▰▰   ☑ #1289   ⑂ #1291                       ← how is it going
```

| Line | Subject | Carries |
|---|---|---|
| 1 | which run this is | the state dot, the title, and the one word spent where a reader must stop scanning |
| 2 | what it is doing at this second | the newest call, in the feed's own words |
| 3 | how it is going | the clock, the Plan's progress, and the two addresses this run answers to |

**The Subagents are not on line 3.** What runs *under* a Session is drawn under its state dot, in
the leading column. That column belongs to the machinery and nothing else on the row claims it.

## The frozen names

These become component files and ticket titles. They do not change without coming back through
here.

| `data-component` | What it is |
|---|---|
| `SessionRow` | the whole row: three lines, one ground, one click |
| `SessionMarker` | the leading column — the state dot, and what runs beneath the Session |
| `SubagentDots` | one dot per running Subagent, and the overflow past five |
| `PlanBar` | one segment per to-do item on the agent's Plan |
| `DeliveryAddresses` | the Ticket and the pull request, each with its own mark |

## The measurements

Everything below is a token or is derived from one. Nothing is a number a builder may choose.

### The leading column

| Measure | Value | Why |
|---|---|---|
| column width | `ArgoIconSize.statusDot` = **6** | every title on the roster hangs off this one x |
| dot inset from the row's top | `(row line − statusDot) / 2` | the dot sits on the **title's optical centre**. Derived, never nudged: a marker aligned by a magic number drifts the moment the type scale moves. The row line is `rowTitle`'s box |
| what "`rowTitle`'s box" is | `ArgoTypeScale.drawnLineBox` | amended in the build (#1343). The `.html` sets `--row-line: 13 × 1.45`, which is CSS's own leading and stands ~1.6pt over the box SwiftUI actually draws a `Text` in; centring against it puts the dot visibly under the title. The box is the resolved face's `ascender − descender`, measured on the render at 12px dot centre against a 106–125px cap band |
| Subagent dot | **4** | half the state dot. What runs *under* a Session is drawn smaller than the Session's own state |
| gap between marks | **3** | tighter than `hair` would place them; the stack has to read as one column, not as a list |
| ceiling | **5**, then `+n` | five is where a stack stops being countable at a glance, and the figure is exact where a longer stack is texture |
| the `+n` label | `machineCaption`, `text.tertiary` | in the column's **flow** at `width: 100%` of a fixed 6pt column, so it overflows evenly on both sides and the column does not grow by a point. Measured: every title stays on one x |

### The three lines

| Slot | Role | Ink |
|---|---|---|
| title | `rowTitle` — body 13, medium | `text.primary` |
| activity | `rowMeta` — subheadline 11, **interface face** | `text.tertiary` |
| the one word | `badge` — caption1 10, semibold, tracking 0.6 | `state.attention`, `state.failure`, or `delivery.open` for `Ready` |
| clock | `machineCaption` — mono, subheadline 11 | `text.tertiary`, and `state.running` for a live Turn duration, exactly as `RosterTurnClock` spends it |
| addresses | `machineCaption` | `text.tertiary` for the Ticket; the pull request's state ink for the pull request |

Line spacing is `ArgoSpacing.hair` between the three; line 3 takes one more `hair` above it,
because it changes subject. Row padding is `7 / base`, the row radius `ArgoRadius.control`.

### `PlanBar`

| Measure | Value | Why |
|---|---|---|
| total width | **64**, whatever the item count | a 12-item plan and a 3-item plan occupy the same space, so a reader compares two rows by how far the fill got and never by how long the bar is |
| segment height | **3** | |
| segment radius | capsule | `ArgoRadius` has no rung under `marker`, and `marker` on a 3pt bar *is* a capsule |
| segment gap | `hair` = 2 | |
| segment width | `(64 − 2 × (n−1)) / n`, floor 2 | derived from the count |
| done | `interaction.accent` | |
| in progress | `interaction.accentBright` | exactly one item is in progress at a time — the rule the list is written under. It draws brightest, because it is the only item anybody can act on |
| pending | `edge.subtle` | |
| a Plan that is not moving | `progress.still` | see the promotions |

## The rules the shape has to keep

1. **The count is the rail's count.** `SubagentDots` draws what `FeedAgents.running(of:)` gives
   the Agents rail. The two must never disagree — a roster indicator that repeats #1269 repeats
   it on every row at once.
2. **The Plan's ink is the accent, never the running teal.** The plan is the Session's own
   *progress*, not its *state*, and the row already spends teal on the dot and on a live Turn
   clock. A third teal thing makes the row one colour. **This applies to `PlanRing` in
   `PlanPill.swift` too**, which strokes its arc with `state.running` today: the pill and the row
   draw the same fact about the same list, and two colours for one fact make a reader work out
   whether they are saying different things.
3. **A Session that is not running is not progressing.** Its Plan is frozen where it stopped and
   the fill drops to `progress.still` — never to `text.disabled`, which makes a finished plan read
   as a plan nobody started.
4. **Zero and never-delegated are two facts.** Never delegated draws nothing at all. Delegated
   and all landed draws one **dash** — an outline there is already spoken for by the unknown
   state, and two outlines under one dot read as two dots.
5. **A state Argo cannot place claims nothing else.** An external Session draws its state as an
   outline and **no** delegation mark: a Session Argo cannot place cannot be claimed to be
   delegating either. Where a *managed* Session holds a delegation Argo cannot resolve (#1076),
   the mark is an outline pip and never a number.
6. **The row carries no control.** The roster has exactly one click and it selects the Session.
   `Ready` is a **state**, drawn where the states the row derives are drawn; the **Create PR**
   control that runs `/ship` lives in the deck header, where the Session is already open. A
   second click target on a row is a row a reader has to aim at.
7. **A ready claim with an open pull request never draws.** The claim is CONVENTION, arriving
   over the companion channel (#1335); the pull request is DERIVED from the code host. The pull
   request wins.
8. **The row does not move, except the running dot's own halo.** No animation on any mark but the
   one operation the row has to report: the running dot's halo breathes, one rise and fall in
   place per pass of `ArgoMotion.working`, never reaching the row's ground. It never travels and
   it never switches, so it never reads as a second pulse out of phase with the row beside it — a
   list where every row pulsed out of phase would be a list nobody could scan.
9. **A fold sums or says nothing.** Its Subagent dots are summed across the runs it hides. It
   draws **no Plan**: four to-do lists do not add up to one.

## The Ticket number leaves the title

`IssueReading.words` draws `#1269 — The rail reads …` today. The moment a pull request landed
beside it, the row carried **two hash numbers meaning different things** and read as one run
against two tickets.

The number moves to line 3, beside the pull request, because **a Ticket and a pull request are
both addresses** and they belong together:

```
☑ #1269      ⑂ #1312
```

- The Ticket takes the **Tickets room's own mark** — SF `checklist`, `ArgoSymbol.ticketsRoom`. A
  number that addresses a Ticket carries the mark the reader clicks to go and read it; a second
  glyph for the same thing is a second vocabulary.
- The pull request keeps the code host's fork, and its merge glyph when merged. The two separate
  by **shape** before their colours do.
- **Both keep the `#`.** The mark says which space a number lives in; the hash says it is a
  number at all — without it `1269` sits beside `4m 12s` as one more quantity on a line of
  quantities.
- The Ticket takes the quiet ink and the pull request its state's, which is the hierarchy that is
  true: **a Ticket is an address; a pull request is an address with a state.**

The title then carries the sentence alone. This also retires the **em dash** in
`IssueReading.words`: once the number is not in the title, there is nothing for the separator to
join, and the open ticket asking for a colon instead has nothing left to fix. **Collapse that
ticket into this work.**

## The contract changes

Three values had no role. All three were agreed before this design landed; each lands with its
framework wiring, its specimen entry and its `all` array.

| Promoted | Value | Role |
|---|---|---|
| `delivery.open` | `#3FB950` | a pull request the code host holds open |
| `delivery.merged` | `#A371F7` | one it merged |
| `progress.still` | `#2F5C89` | a Plan that has stopped moving — the accent, banked |

Two values **snapped** rather than promoting near-duplicates:

- a closed pull request → `state.failure`. Six points from `#F85149`; two reds on one row is the
  same mistake as two greens.
- a draft pull request → `state.idle`. Three points from `#8B949E`.

**The green stands.** `delivery.open` sits one hue from `state.running`, and on a running row the
Turn clock spends the running ink too — three greens on one row. That was put and answered: the
code host's own inks are what a reader arrives already knowing. The mitigation is shape, not
hue — the pull request is a glyph and a number, never a filled chip, and its mark differs from
everything else in the row's trailing group.

## What did not change, and was thought to have

**Selection is already right.** `argoSelectedRowGround` paints `interaction.selectionGround`
(`#203146`, the accent at 0.18 over sunken) in both rails **and** the backlog since #1165, with
the platform's own list fill switched off at the table (D30 as amended by #875/#906/#922). There
is no custom grey wash to replace and no second selection vocabulary to unify — the roster and
the Tickets room already draw one ground. The ground carries the selection and nothing else does:
still no leading accent rule.

## What the prototype exposed that the renders do not show

- **A pip stack does not read as a count.** Three running and twelve running drew almost the same
  stack at the old ceiling of three. That is why five, and why the exact figure past it.
- **Filled PR chips turn the roster into a wall of pills.** An earlier variant drew the pull
  request as a filled capsule; nine rows became nine coloured pills and the state dot stopped
  being the first thing the eye finds. Hence a glyph and a number.
- **A variant that moved the activity to a tooltip read beautifully and answered the wrong
  question.** The roster is scanned to find out what is happening; a row carrying only delivery
  facts is a delivery list.
- **The delegation glyph and the pull-request glyph look alike at 11px.** Both were
  node-and-branch marks. The Subagent count is a dot stack now and never a glyph, which is part
  of why.

## The states

Every one is reachable at `?state=<name>` and rendered in `roster-row/`.

| State | What it settles |
|---|---|
| `running` | the ordinary row: three Subagents, a live clock, a Plan mid-flight, an open pull request, selected |
| `ceiling` | twelve Subagents — five dots and `+7` |
| `merged` | delegated nothing, Plan complete, pull request merged |
| `spent` | delegated five and all home, idle, Plan frozen, pull request closed |
| `ready` | the Session says it is ready to ship and has no pull request — a full bar and no mark |
| `unknown` | an external Session: ghosted, state an outline, no delegation mark |
| `attention` | waiting on the reader |
| `fold` | four headless runs behind one row |
| `empty` | nothing under it and nothing out of it — line 3 carries the clock alone |

## Related

- #1310 — the ticket this answers, and the prototype's home.
- #1335 — the companion report behind `Ready`, and the action behind **Create PR**.
- #1269 — the rail read `0 running` while the Subagents wrote.
- #1076 — the record alone cannot close a delegation.
- #1199 — why line 2 carries the activity, and why the clock sits where it does.
- #1072, #745 — how the title is decided, and what the meta slot used to carry.
