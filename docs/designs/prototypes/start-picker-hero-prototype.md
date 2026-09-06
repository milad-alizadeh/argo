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

## The five variants

All five are the same card in the same 280 rail, with the shipped pane-header pill above them for
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

## Reading the URL

| Parameter | Effect |
|---|---|
| `?v=A\|B\|C\|D\|E` | which foot. **Opens on `E`**, the pick. Also `←`/`→`, or the bar at the bottom right |
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
| **A** pill | 19.6 | **0.7** | **−24.4** | | | |
| **B** token beside Start | 31.6 | 12.7 | **−12.4** | −31.2 | −62.2 | −93.8 |
| **C** shipped | 53.4 | 34.5 | 9.3 | **−9.5** | −40.5 | −72.0 |
| **E** token on its own line | 102.3 | 87.0 | 66.5 | 51.3 | 25.8 | **0.3** |

D keeps a 62.6pt foot at every size, because its command is not on the foot at all.

### The four things this caught, all measured, none by eye

| | |
|---|---|
| **A fits at 280 — and only at one text size.** The width objection everybody expects is not the fault | 19.6 slack at 100%, **0.7 at 115%**, over the edge by 24.4 at 135% |
| **The pill costs 34pt of chrome the plain starter does not spend** — `vesselInset` twice plus each segment's own horizontal room — and the card at 280 has 53.4 to give | 204.4 against C's 170.6, same command, same rail |
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

### 5. Does the hero get the picker? Yes — and not as the pill.

**The two surfaces should not agree by transplanting the control.** They are not the same
surface: the pane header spends a whole window-wide band on one row of chrome, and the hero is a
card at the foot of a 280 rail that already spends its width on a title, an id and two chips. The
pill is the right shape in a band and the wrong shape on a card, and the number that says so is
that it is 0.7pt inside the card one notch above the default text size.

**`E` is the pick.** The command on its own line, on the card's leading edge; `Start` alone below
it, trailing. It is the only shape here that offers the picker and still fits at 200% text, and
the reason is structural rather than lucky: **nothing on the foot has to shrink for anything
else.** A and B both fail because two facts are competing for one 224pt line, and one of the two
is a command that can be fifteen characters long.

**It costs the rail a line** — the card grows from 157.2 to 184.5, about 27pt off the views above
it. That is the trade, and it is the one to take: the alternative is a control that is correct at
one text size.

`E` also keeps the reading `StartVerb` already has. The hero's `Says.whole` becomes `Says.word`,
exactly as the pane header's already is, and the command moves to a control of its own. Neither
the verb nor the command is spelled a second way, which is the fault `StartVerb` exists to prevent.

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

**`E`.** The hero gets the picker, on a line of its own rather than inside the starter's vessel;
the pick is spent on one Session and never filed against the ticket; the menu marks its default
with a tick and keeps the reason beside it.
