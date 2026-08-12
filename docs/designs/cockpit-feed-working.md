<!-- status: approved
     approved-at: 7386f5f
     prototype: worktree-prototype-working-motion -->

# A Turn in flight — the ion

The approved design for what the feed draws while a Session is `running`. It replaces the
static `working…` mark (`FeedWorking.words`) and gives `FeedCall.Ending.pending` a rendering
it has never had.

**The renders in [`working/`](working/) are the spec.** The measurements below are the numbers
a ticket must carry — prose that omits them cannot be failed for getting them wrong.

The study lives on the throwaway branch `worktree-prototype-working-motion`
(`docs/designs/prototypes/working-motion-prototype.html`), where the rejected variants are still
switchable, and its render harness (`working-motion-render.html`) is what produced the PNGs here.
It is there to be re-explored, not built from.

## Why this is allowed to loop

This is a **live operational signal**, which
[D12](cockpit-visual-identity-decisions.md#d12--motion-responds-it-never-performs-ambiently) lets
loop for exactly as long as its operation lasts. Read D12 for the bound and the test; the operation
here is the Turn, and the event that ends it is the Turn ending. A pass still running after that is
a defect, not a flourish.

**This is not `Ion Trace`.**
[D13](cockpit-visual-identity-decisions.md#d13--delight-has-an-optical-mechanical-character)'s
`Ion Trace` is a delight moment — one brief charge along the canopy/deck seam when the active
Session changes — deferred by D41. This is a loop inside the Instrument Deck reporting live work.
They share the palette's word for Argo's accent and nothing else, so
[#383](https://github.com/milad-alizadeh/argo/issues/383)'s *"No Ion Trace"* and *"never loops"* do
not reach this design.

## The two states are exclusive

A Turn in flight is **either** running a tool **or** thinking. Never both, and never neither.

| Condition | What draws | Render |
|---|---|---|
| `status == .running` and a call is `.pending` | the ion crosses that **row's type**; no thread | [`tool.png`](working/tool.png) |
| `status == .running` and nothing is pending | the **thread** crosses the measure; no row is lit | [`think.png`](working/think.png) |
| anything else | nothing | — |

Drawing both would claim two waits where the record has one. `FeedWorking.isWorking` is true
across both, so the projection has to split on the pending call, not on the status alone.

The moment a call goes pending the thread must leave, and the moment it resolves the thread must
return — the same row cannot hand over twice, so the swap belongs in one place in the projection.

## The ion

One ramp, four stops, all existing tokens. It is Argo's own: `interaction` running into
`state.running`.

| Stop | Token | Value |
|---|---|---|
| 0% | — | transparent |
| 28% | `interaction.accentDeep` | `#1E6FD4` |
| 55% | `interaction.accent` | `#3E9BFF` |
| 76% | `interaction.accentBright` | `#6FB6FF` |
| 88% | `state.running` | `#46D3A8` |
| 100% | — | transparent |

Deep blue tail into a mint head, with a long tail and a tight falloff at the front, so a pass
has a **direction**: the head is where the work is. Horizontal in both surfaces — the study's 96°
tilt was jitter and reads as a rendering defect at 13pt.

The ramp is one substance at two lengths. **The thread is 30% of the measure. The row's wash is
the full length of the line**, which is why the whole command lights at once rather than a tight
highlight crossing it.

## The call in flight — `tool.png`

The **whole row is one painting surface**: the gradient is masked to the row's text, not to each
span, so the ion crosses `Ran rtk err bun run quality:swift` as a single piece of type. Painting
per-span restarts the sweep at every word boundary; that was the study's first rejected attempt.

| Measurement | Value | Source |
|---|---|---|
| Rest ink, whole row | `text.secondary` `#A8AEB5` | one step above the finished calls, which sit at `text.tertiary` / `text.secondary` |
| Chevron | `text.disabled` `#4E545A` | excluded from the mask |
| Kind glyph | `interaction.accent`, reaching `state.running` as the head passes column 0 | |
| Wash length | the full line | |
| Travel | leading edge first, left to right | |
| Period | `ArgoMotion.working` | |

The rest ink is doing two jobs: it separates the live row from the dead ones, and it **is** the
Reduce Motion state.

*The glyph is a seam.* In the study it is SVG taking `stroke: currentColor`, so it could not be
clipped by the same gradient and its colour is a hand-phased keyframe. In Swift the glyph and the
text can share one real mask — do that rather than porting the keyframe.

## The thread — `think.png`

| Measurement | Value | Source |
|---|---|---|
| Lane width | 720pt | `ArgoFeedRow.column` — **the full measure**, not the 672pt text column |
| Lane bleed | 24pt each side | cancels `ArgoFeedRow.inset` |
| Lane height | 20pt | `ArgoFeedRow.lineHeight` |
| Filament length | 30% of the measure = 216pt | `ArgoFeedRow.workingThreadShare` **(new)** |
| Filament thickness | 2pt | `ArgoStroke.indicator` |
| Filament ends | capsule | height ÷ 2 |
| Glow | blur 4, no offset, opacity 0.6 | `ArgoElevation.bloom` **(new)** |
| Travel | −105% to 340% of the filament's own width | fully outside the lane at both ends |
| Period | `ArgoMotion.working` | |

**Edge to edge is the point.** The thread is the one thing in the feed that ignores the row
gutter, because a whole-column signal should touch both edges of the column. Both tips of the
filament are transparent and the travel starts and ends entirely outside the lane, so it fades in
and out at the measure's edges rather than appearing mid-air. The lane clips, so it never spills
into the deck beyond the measure.

**Nothing is drawn at rest.** The line exists only where the ion is. That is not decoration: a
static full-width hairline already means `turn ended` (`FeedMark.turnEnded(.endTurn)` renders as
the rule alone), so a thread with a resting track would collide with a mark that means the
opposite.

**Animate `transform` only.** A translating element is compositor-owned; animating a gradient's
position is not, and a blur filter on a moving element repaints every frame. Between them, that
was the study's choppiness. The glow is a second filament carrying the same transform, blurred
once.

## The age of the wait — `aged.png`

Past roughly 10s a wait stops being part of the interaction, so a 6-minute think must not look
like a 3-second one.

| Age | Period | Glow |
|---|---|---|
| under 10s | 1.9s | 0.60 |
| 10s – 60s | 2.8s | 0.49 |
| 1m – 5m | 3.8s | 0.40 |
| over 5m | 4.9s | 0.30 |

The ion **cools and slows**; it never warms. Claude Code warms its spinner to amber at 10s, and
Argo must not: `state.attention` means *something needs you*, and a long think needs nothing.
Warming would render a false call for attention, which is exactly what the degrade-down rule
exists to prevent.

A still cannot show a period, so `aged.png` carries the numbers in its captions and shows only
what a still can — the glow falling away.

Applies to **both** states. A command that has been running six minutes is the case most worth
noticing.

## Reduce Motion — `still.png`

A loop has no shorter answer, so `reducedDuration` cannot express it. Each state gets a **still**
instead.

- **Tool in flight** — the row sits at its rest ink, one step above the calls above it, glyph in
  `interaction.accent`. No gradient.
- **Thinking** — the thread parks at the centre of the measure, glow at 0.4.

Both still read as live with nothing moving, which is the requirement.

## The word

`FeedWorking.words` — `working…` — **is deleted.** `FeedWorking.spoken` — "The agent is working"
— **stays**, in a status region. Taking the word off the screen must not take it off the screen
reader.

## The contract changes this needs

`ArgoMotion` today states that every role is brief and event-driven, that **nothing in the
contract loops**, and that no role exceeds `durationCeiling` 0.5s. This is the first loop, so
that has to change, and the change was chosen deliberately over a separate `ArgoLoop` family.

1. **`ArgoMotion.repeats: Bool`** — new stored property, so Reduce Motion can *stop* a loop rather
   than shorten it, and so the contract sheet can render loops as loops.
2. **`ArgoMotion.Curve.linear`** — new case. The row's wash is linear; an eased text sweep reads
   as a stutter.
3. **`ArgoMotion.working`** — the first repeating role. Period 1.9s at rest, `.linear`,
   `reducedDuration: nil`, `repeats: true`.
4. **`durationCeiling` amended** — the 0.5s cap holds for every non-repeating role and stops
   applying to repeating ones. The doc comment saying nothing loops is rewritten, not deleted:
   it should now say there is exactly one loop and why.
5. **`ArgoFeedRow.workingThreadShare: CGFloat = 0.3`** — a share of the column, following
   `bubbleShare: 0.78`, so the filament tracks `column` instead of freezing at 216pt.
6. **`ArgoElevation.bloom = ArgoElevation(blur: 4, yOffset: 0, opacity: 0.6)`** — a glow is an
   elevation with no offset, and the struct already has that shape.
7. **`ArgoPalette.ion`** — the ordered four-stop ramp. `ArgoPalette` has no gradient roles today,
   and the ramp is used by two surfaces, so it cannot live at either call site.

Every one of these must appear in its family's `all` array, or `VisualContractTests`' `Mirror`
assertion fails the build — that guard exists because the specimen once drew four of six groups
and a lavender ink shipped without ever being looked at.

## What the study exposed that the renders don't show

Three things learned in exploration that no PNG carries.

1. **A bare rule already means the opposite.** `FeedMark.turnEnded(.endTurn)` draws as a hairline
   with no words. Any resting track under the thread reads as "a turn ended here", which is why
   the thread draws nothing at rest. This killed two earlier variants outright.
2. **Per-span painting is the trap.** The obvious way to sweep a row — put the gradient on each
   text span — fires every span at once and restarts at each word. It looks correct in a still and
   wrong in motion, so a screenshot review cannot catch it.
3. **The number is what people trust.** Across Claude Code and Codex, users judge alive-versus-hung
   from elapsed time and token count, not from the animation. The rejected variants H, I and K all
   carried a clock; **J does not**, so the feed now has no reading of how long a Turn has run.
   That fact needs a home in the Session header or the roster row. It is not in this design and it
   is not an oversight — it was the open question this one left, and #618 settled it in the
   roster row: [`cockpit-roster-turn-clock.md`](cockpit-roster-turn-clock.md).

## Frozen names

`FeedWorkingThread`, `FeedCallLineIon`. These become component names and ticket titles; renaming
later is a migration.
