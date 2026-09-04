<!-- status: built
     approved-at: 61181a8
     built-at: d376aa7
     prototype: worktree-prototype-618-turn-elapsed -->

# The roster Turn clock

The approved design for **how long a Turn has been running** (#618). The reading lives in the
Sessions roster row — the age slot on the secondary line — and nowhere else. The Session header
stays silent, and the feed stays silent, which
[`cockpit-feed-working.md`](cockpit-feed-working.md) already settled.

**The renders in [`roster-clock/`](roster-clock/) are the spec.** The measurements below are the
numbers a ticket must carry.

**The reading counts the Session, not any one Turn (#1330).** It runs from the resume-chain's
first prompt to now, and a Turn boundary in between changes nothing — the gaps between Turns
count too, which is the simpler rule and the one every render here already shows: nothing in
`roster-clock/` draws a reset at a Turn boundary. The dot's own pulse (#1291, its sweep speed)
still paces off the CURRENT Turn's freshness; that is a different fact and did not move with
this one.

The study lives on the throwaway branch `worktree-prototype-618-turn-elapsed`
(`docs/designs/prototypes/turn-elapsed-prototype.html`), where the three rejected placements are
still switchable (`?variant=A|C|D`) and the clocks actually tick. It is there to be re-explored,
not built from.

## What won, and what lost

Variant B: the roster row ticks, and only the roster row. It won because it answers the actual
question — *which of my seven is stuck?* — for every Session at once, without selecting each.
The rejected variants each put a reading in the Session header (beside the state word, as a
10s-gated turn meter with a live token count, or split across both surfaces); the header saying
nothing is a decision, not an oversight. A live token count appears nowhere: the cost meter was
variant C and D's question, and the answer was no.

There is no appearance threshold. NN/g's 10s line says when a wait *owes* the user a reading;
the roster is glanced at, not watched, so the reading is simply always there while the Turn is.

## One slot, three readings

The age slot is **one** slot. It never shows two readings, and each reading's wording carries
its honesty tier — a bare figure is a duration Argo owns; `ago` marks a point in time Argo
merely saw. The roster already made that split when it worded idle age `2m ago`
(`roster-header-prototype.html` settled that a bare `2m` reads as a duration), so the clock adds
no new vocabulary — it *uses* the distinction the wording already carried.

| Condition | Reading | Ink | Tier |
|---|---|---|---|
| managed and `running`, Session start known | `4m 12s` — live duration, ticking from the resume-chain's first prompt, unbroken by any Turn boundary in between | `state.running` | DIRECT |
| observed (external) and mid-turn per its transcript | `output 12s ago` — resets as records land | `text.tertiary` | DERIVED |
| anything else | `2m ago` — the existing seen reading, unchanged | `text.tertiary` | as today |

**Degrade-down is the row's rule.** A managed Session whose start Argo cannot vouch for (the
resume-chain's first prompt unstamped, record missing) takes the seen reading, never a guessed
duration. An observed
Session never shows a duration at all — Argo has only the last record's arrival, and a quiet
mid-turn genuinely reads as idle, so `output … ago` states exactly what is known and nothing
more. It never takes `state.running` ink: mint on a derived reading would render a false DIRECT.

## Measurements

| Measurement | Value | Source |
|---|---|---|
| Placement | the age slot: secondary line, leading edge | `SessionRow.secondaryLine` — the slot exists; only its content changes |
| Type role | `ArgoTypography.rowMeta` with monospaced digits | the slot's existing role; monospaced digits so a tick never wobbles the row (**new modifier, not a new token**) |
| Live ink | `state.running` `#46D3A8` | the dot's own ink as a figure; the one running-ink text in the sidebar |
| Derived + seen ink | `text.tertiary` `#929AA1` | the secondary line's existing ink |
| Format, under a minute | `42s` | |
| Format, under an hour | `4m 12s` — seconds padded to two digits | |
| Format, past an hour | `1h 04m` — minutes padded, no seconds | an hour-long turn is not read to the second |
| Tick cadence | 1s | a content change, not motion — no `ArgoMotion` role, unaffected by Reduce Motion |
| Layout priority | the reading keeps the age's priority: above the worktree label, below nothing | `SessionRow.secondaryLine` today |
| Announcement | appended to `row.announcement`: “running for 4 minutes 12 seconds” / “last output 12 seconds ago” | the reading must reach the screen reader the same way it reaches the eye |

## What this changes, and what it does not

- `SessionRosterProjection.Row` gains the Turn reading; the split between the three readings is
  the **projection's** job, in one place — the view renders whichever it is handed.
- The header's facts, the tab line's `tokens used · started · worked`, and the feed's ion/thread
  are untouched.
- No contract change. Every value above is an existing token; the only addition is the
  monospaced-digits modifier on `rowMeta`, which is a `Text` modifier, not a role.

## What the prototype exposed that the renders don't show

1. **The tick must not re-render the row.** The prototype's first draft re-rendered on every
   second and visibly restarted the feed thread's sweep mid-pass; it had to write into the
   rendered text alone. In SwiftUI that means the timer scopes to the reading's own `Text`
   (e.g. `TimelineView` around the label), never to the `List` or the row.
2. **Only running rows tick.** Seven clocks sounded noisy in prose; on screen it is three mint
   figures among grey ones, and the mint is what makes the running set scannable. The fixture's
   three concurrent runners (4m, 21s, 6m 40s) read as a set at a glance.
3. **The observed reading resets visibly.** `output 12s ago` snapping back to `1s ago` as a
   record lands is the liveness signal for external Sessions — it is the same fact the managed
   clock shows, at the honesty the record supports.

## Frozen names

`RosterTurnClock`. It becomes the component name and the ticket title; renaming later is a
migration.
