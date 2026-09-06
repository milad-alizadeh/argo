# Does the Next-up hero get the skill picker? — throwaway prototype (#1244)

**A primary source, not a starting point.** Written under prototype constraints — no tests, no
abstractions, one file. The validated decision belongs in `cockpit-work-room.md`, not here.

## Run it

```sh
open docs/designs/prototypes/start-picker-hero-prototype.html
```

No build, no server, no dependencies.

## #1244 is mostly already answered, and this says which part was not

The ticket asks six questions about making `Start` a split control. **Four of them were settled and
shipped by #1242 and #1435 before this study began**, and re-opening them would have been a study
of a decision that is already in the app:

| #1244 asks | where it stands |
|---|---|
| 1. the shape — split, plain menu, or a modifier key | **shipped.** `StartControl` is ONE capsule; `Start` and the command are its segments and the command token opens the picker |
| 2. what the menu holds, and in what order | **shipped.** `WorkCommand.offered` — `/implement · /design-to-code · /grill-me · /triage · /prototype · /wayfinder` — written down rather than taken from `allCases`, so the reading order is a decision somebody made |
| 6. where `/triage` lives | **shipped.** A `WorkCommand` case that is OFFERED and never RESOLVED. No rule guesses it, because deciding for a reader that a ticket needs triaging is the guess triage exists to answer |
| — its premise, that the resolver often answers `nil` | **gone.** #1182 (#1435) made `/implement` the last rule, so only the two refusing label sets produce no command. The ticket's motivating fault does not reproduce |
| 3. how the default is shown inside the menu | **partly.** The matched row carries its reason; nothing carries a tick. §3 below |
| 4. what the reader's pick does after the press | **open.** It is this-Session-only in the code and unstated anywhere. §4 below |
| 5. whether BOTH hero surfaces get the menu | **open.** `NextUpStarter` has no picker, and no doc says that is deliberate. §5 below |

So this study is about the hero, the memory rule, and the tick. It is deliberately not a second
opinion on the pill.

**On the reversal #1244 asks to be justified**: `cockpit-work-room.md` already carries it, under
**the picker offers SKILLS, and this is not #872 coming back**. #872 deleted a chevron offering
Mode **rungs** — one honest answer, confirmed on every open, and a control downstream over a live
Session that owns the fact. The command has six answers, its default is a guess off a label rather
than a value the reader set, and **nothing downstream can change it**: the command is the first
thing sent. Both readings survive this study unchanged, and nothing below reopens them.

## The six variants

All six are the same card in the same 280 rail, with the shipped pane-header pill above them for
comparison. Only the card's foot changes.

- **A — the toolbar's pill, transplanted.** One capsule, two segments, exactly as the pane header
  draws it. The obvious answer to "make the two surfaces agree".
- **B — the token stands outside the button.** `Start` keeps its own vessel and one target; the
  command sits beside it as a bare pressable token. Two targets, one line, neither inside the other.
- **C — no picker on the hero.** The null, and what ships today: one press, the whole verb.
- **D — the command joins the chips.** The one chip that is a control, saying the command is a
  property of the ticket rather than of the button.
- **E — the command takes its own line.** The token on the card's leading edge, on the line the id
  and the chips already start on; `Start` alone in the trailing corner below it.
- **F — the ticket pane's pill, at the card's scale.** The shipped control with three numbers
  stepped down one rung each: the vessel's inset `hair` rather than `vesselInset`, each segment's
  horizontal room `snug` rather than `base`, and the box they stand in the height the hero's
  starter already draws rather than `ArgoControlBox.icon`. **The command ellipsizes**; `Start`
  never shrinks.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?v=A\|B\|C\|D\|E\|F` | which foot. **Opens on `F`**, the pick. Also `←`/`→`, or the bar at the bottom right |
| `&trunc=0` | switch F's ellipsis off, to see the ink it prevents |
| `&cmd=implement\|design-to-code\|grill-me\|triage\|none` | `/design-to-code` is the longest; `none` is the ticket whose labels refuse a command |
| `&mark=reason\|tick\|both` | how the resolved command is marked inside the menu |
| `&memory=session\|ticket` | whether a pick is spent on one Session or remembered for the ticket |
| `&menu=hero\|head` | which picker is open. Never both — two popovers on one frame hide the surface under study |
| `&w=280\|320\|360` · `&chips=2\|1\|0` | the rail at its floor, and how many reasons the pick earned |
| `&scale=1\|1.15\|1.35` | the reader's text size. It moves the TYPE and nothing else |
| `&check=1` | print the probe on load, so a headless run can read it out of the DOM |

The bar's **`check`** button re-proves the page's own rule and prints the deltas, so the next edit
is measured rather than eyeballed:

> Every visible edge on the card starts on the card's own content box and stops on it. No line of
> the foot may exceed that box at any width, any command, or any text size the platform allows.

## What it measured

Widest line of the foot against the card's 224pt content box at the 280 rail, on
`/design-to-code` — the longest command `WorkCommand.offered` holds. **Negative slack is ink
outside the card.**

| | 100% | 115% | 135% | 150% | 175% | 200% |
|---|---|---|---|---|---|---|
| **A** pill, full size | 19.6 | **0.7** | **−24.4** | −43.2 | −74.2 | −105.8 |
| **B** token beside Start | 31.6 | 12.7 | **−12.4** | −31.2 | −62.2 | −93.8 |
| **C** shipped | 53.4 | 34.5 | 9.3 | **−9.5** | −40.5 | −72.0 |
| **E** token on its own line | 102.3 | 87.0 | 66.5 | 51.3 | 25.8 | **0.3** |
| **F** pill at the card's scale | 33.6 | 14.7 | **0.0** | **0.0** | **0.0** | **0.0** |
| F with `&trunc=0` | 33.6 | 14.7 | −10.4 | −29.2 | −60.2 | −91.8 |

D keeps a 62.6pt foot at every size, because its command is not on the foot at all.

**F's zeros are the point.** It fills the card's content box exactly and stops there: past 115%
the command ellipsizes rather than pushing, so the foot cannot leave the card at any text size.
The row under it is the same shape with the ellipsis switched off, which is what the truncation
prevents — and is what the shipped `StartCommandWord` would do today, because it carries
`.fixedSize()`.

### The four things this caught, all measured, none by eye

| | |
|---|---|
| **A fits at 280 — and only at one text size.** The width objection everybody expects is not the fault | 19.6 slack at 100%, **0.7 at 115%**, over the edge by 24.4 at 135% |
| **The pill costs 34pt of chrome the plain starter does not spend** — `vesselInset` twice plus each segment's own horizontal room — and the card at 280 has 53.4 to give | 204.4 against C's 170.6, same command, same rail |
| **Stepping those three numbers down one rung recovers most of it**, and the picker then costs the card 1.8pt of height | F 190.4 x 28.0, card 159.0, against A's 204.4 x 36.0 / 167.0 and C's 170.6 x 26.2 / 157.2 |
| **A `max-width` binds against the parent, and the parent was an inline span that sizes to content** — so the first truncating build measured identically to the non-truncating one | −10.4 at 135% before the host became a shrinkable flex child, 0.0 after |
| **The shipped hero is itself within 9.3pt of the edge**, and goes over at 150% | C: 214.7 at 135%, 233.5 at 150%. This is true of the app today and owes nothing to this ticket |
| **D's command chip does not fit the chip line and wraps**, costing the card 25pt and putting a control in a row the design calls labels | card 182.2 with two earned chips against C's 157.2; 160.1 with one chip or none |

### And one the probe caught in itself, twice

Both were faults in how this page modelled the app, not findings about the app, and both would have
been reported as findings if the numbers had been trusted on their first reading:

- **A CSS `border` grows a box; SwiftUI's `strokeBorder` draws inside the shape and costs it
  nothing.** Modelled with borders, this page reported the hero's pill as 38 against the header's
  36 and invented a 2pt disagreement between two controls that are the same height. Every rim here
  is now an inset shadow.
- **Scaling the reader's text by zooming the rail widens the rail**, which Dynamic Type never does
  — every width above would then have been measured against a 378pt sidebar. The scale multiplies
  the type roles only.

## The answers

### 5. Does the hero get the picker? Yes — the ticket pane's own pill, at the card's scale.

**`F` is the pick.** The hero draws the control the ticket pane already draws, stepped down to the
card: same two segments, same token-is-the-picker gesture, same rim and ground the starter has
today. One line, and the reader learns one control rather than two spellings of one act.

**Transplanting it at full size does not work, and the fault is not the one you expect.** `A`
fits at 280 — the width objection everybody reaches for is wrong. It is **0.7pt inside the card
one notch above the default text size**, because the full-size pill spends 34pt of chrome the
plain starter does not: `vesselInset` twice, and `ArgoSpacing.base` on each of two segments.
Stepping those three numbers down one rung each recovers 14pt of width and 8pt of height, and
takes the card from `A`'s 167.0 to 159.0 — **1.8pt over the shipped starter's 157.2.** The
picker becomes almost free.

**What closes the gap at large text is the ellipsis, not the smaller numbers.** Even compact, the
pill is 10.4pt outside the card at 135%. `StartCommandWord` carries `.fixedSize()` today —
correct in the pane header, where the pill has a whole band — and on a 224pt card it is what
turns a long command into ink outside the card. So on the hero **the command ellipsizes and
`Start` never shrinks**: the verb is what the card exists for, and the token is the half that can
give. `/design-to-c…` at 135% is still the command a reader can identify, and past that point
every other line on the card is wrapping too.

**The runner-up, on the record.** `E` puts the command on a line of its own and never truncates
anything — 66.5pt of slack at 135%, still 0.3 at 200%. It loses on two counts: it costs the card
27pt against `F`'s 1.8, and it puts the command somewhere the ticket pane does not, so the two
surfaces stop agreeing on where the fact lives. `F` trades an ellipsis at large text for one
control the whole app spells the same way. If the ellipsis is later judged dishonest, `E` is the
shape to fall back to, and this study's numbers stand.

Both `E` and `F` keep the reading `StartVerb` already has: the hero's `Says.whole` becomes
`Says.word`, exactly as the pane header's already is, and the command moves to a control of its
own. Neither the verb nor the command is spelled a second way, which is the fault `StartVerb`
exists to prevent.

**What `F` costs, said plainly.** A second set of numbers for one control. `StartControl` would
draw at the band's scale in the pane header and the card's scale on the hero, and #1243 has just
finished removing exactly that kind of per-surface box arithmetic. The three numbers are rungs
that already exist rather than new measurements, but they are a second rung ladder for a control
that had one, and the design has to name the surface that justifies it: **a card in a 280 rail
is not a window-wide band, and that is the whole of the reason.**

### 4. A pick is spent on ONE Session. It is not remembered for the ticket.

Three reasons, and the first is the one that settles it:

**A remembered pick would render as a false DIRECT.** The token draws the resolver's answer, which
is DERIVED — read off the ticket's labels and the tree. A stored pick is DIRECT, and drawn
identically the reader cannot tell which they are looking at. Argo's degrade-down rule is that
ambiguity resolves to the lower tier and a false DIRECT is never rendered, so remembering a pick
means drawing it differently — a second state on a control this study has just spent its whole
width budget on.

**#629 and #941 already settled the shape of this question for the rung.** A rung chosen on a live
Session is filed as a pick; a ticket's `Auto` never is. The parallel is exact: a command chosen
before the Session exists is a guess about work nobody has started, not a preference.

**And it would be new Argo-side state keyed on a provider's id.** Argo stores the link to a Ticket
and never its content. A per-ticket command preference is content the provider does not own and
cannot be asked for.

**What the menu says about it.** Nothing. A menu that has to explain that a pick is not remembered
is a menu answering a question the reader had no reason to ask.

### 3. The default takes a TICK, and keeps its reason.

The reason stays — it is the inspectability #1242 wanted, and `— the screen has a design` beside
the matched row is why the guess is not magic. But **the reason cannot be the marking**, and the
probe says why:

```
mark=reason   cmd=/design-to-code   menu 289.4   marked rows: /design-to-code
mark=reason   cmd=/triage           menu 250     marked rows: NONE
mark=tick     cmd=/triage           menu 250     marked rows: /triage
```

`WorkCommand.why(.triage)` is `nil`, so a menu that marks by reason alone marks nothing at all
when the resolved command has no reason to give. **Today that state is unreachable** — nothing
resolves to `.triage`, which is the whole point of that case — so reason-only marking is correct
by coincidence rather than by rule. The day a rule resolves a command whose `why` is `nil`, the
menu silently stops saying which row is the default. A tick does not depend on the reason table.

The reason also costs the menu 39.4pt of width and takes it 33.4pt past the rail's own trailing
edge. That is fine — an AppKit menu is a window and may overhang — but it is worth knowing that
the menu the hero opens is wider than the sidebar it opens in.

## What is faithful, and what is not

Every colour, spacing step, radius, stroke, control box and type role is transcribed from
`apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign/` — `GraphitePalette`, `ArgoSpacing`,
`ArgoRadius`, `ArgoStroke`, `ArgoControlBox`, `ArgoTypography`, `ArgoTypeScale` — and the card's
own insets from `ArgoTicketsSidebar`. Nothing is chosen. Where a number here disagrees with the
package, the package is right and this file is stale.

The menu is an approximation of AppKit's popover and is **not** evidence about how a real `Menu`
positions, sizes or animates — AppKit places and draws its own, which `cockpit-work-room.md`
already records. What it is evidence about is what the rows say and how wide they get.

It is not a component structure and nothing here should be ported line by line.

## The answer, in one line

**`F`.** The hero gets the ticket pane's own pill, at the card's scale, with the command
ellipsizing and `Start` fixed; the pick is spent on one Session and never filed against the
ticket; the menu marks its default with a tick and keeps the reason beside it.
