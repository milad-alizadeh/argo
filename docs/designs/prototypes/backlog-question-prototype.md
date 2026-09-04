# A question asked of the backlog — throwaway prototype

**This branch is a primary source, not a starting point.** It exists so the choices in
[#1293](https://github.com/milad-alizadeh/argo/issues/1293) can be *looked at* rather than
argued about in prose. It is deliberately not on `main`: it was written under prototype
constraints — no tests, no abstractions, one file — and whatever it settles belongs in the
design, not here.

> `docs/designs/README.md` records that HTML studies were retired from the committed design set
> when the runtime locked to Swift (ADR-0022). This is not a re-opening of that: it is a
> throwaway on a throwaway branch, which is where the `prototype` skill puts them — the same
> standing `roster-header-prototype.html` and `ask-vessel-prototype.html` have.

## Run it

One file, no build, no server, no dependencies.

```sh
open docs/designs/prototypes/backlog-question-prototype.html
```

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A…F` | Which shape. Also `←`/`→`, or the bar at the bottom. |
| `&state=<name>` | Which state of that shape. Also `↑`/`↓`, or the pips on the bar's right. |

The bar has **two axes on purpose**: the variants are not exclusive, and the ticket says so.
B and C disagree about *what opens it*; D and E disagree about *where the answer draws*; F
disagrees about whether it belongs in the room at all. A reader can take B's opening with E's
answer, and the bar should not pretend otherwise.

Every state in #1293 is reachable by URL. A state you cannot link to is a state nobody re-checks.

## The question it answers

*Where does a natural-language question about the backlog live, and what does it give back?*

The case that opened the ticket, staged over the fixture: the reader wants the ticket about
**spacing between nodes on the chart** and types `chart`. No fixture title uses that word, so the
plain field states an honest empty and the reader is no better off. The answer is **#336, The
canvas: derived spacing and the edge rule** — and #336 cannot start, because #335 is in the way
and that waits on #334.

That is the shape of the real failure. The reader knows what the ticket is *about*; they do not
know the word its title used.

## The six variants

| | Shape | What it proposes |
|---|---|---|
| **A** | the field as shipped | the control — the number and the title, folded, and nothing else |
| **B** | a wand at the field's trailing edge | a popover chat anchored to the field; the answer draws inside it |
| **C** | the field takes the question | one field; the ask is **found**, never switched to |
| **D** | an answer that is rows | the list narrows to what was suggested; the heading says so |
| **E** | an answer that is prose | a sheet over the ticket pane; every number in it is a link |
| **F** | the Session route | the room's menu opens a Session with the question and the view |

D and E are drawn with B's opening, because an answer has to arrive from somewhere and B is the
opening that costs the least to assume. Neither is a vote for B.

## The data is the fixture, verbatim

The twelve open tickets, their tree, priorities, labels, blockage marks and age stamps are
transcribed from `TicketsFixture+Items.swift` — the same twelve `ARGO_SPECIMEN=ticketsRoom`
renders. Nothing is invented, so a row that looks wrong here is a row that looks wrong there.

Every colour, radius, spacing step and type size is transcribed from
`apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign/` — `GraphitePalette`, `ArgoSpacing`,
`ArgoRadius`, `ArgoTypeScale`, `ArgoLayout` — and the pane widths from `ArgoBacklogList` and
`ArgoTicketsChrome` (the field is 210 × 28; C widens it to 268). The shell was corrected against
a render of the running app, not against the design prose.

**One thing a browser cannot do:** the sidebar is native Liquid Glass in the app (D2/D3/D14) and
is approximated here with a translucent column. If it reads flat, that is this file's limit and
not a proposal.

---

## What the prototype settles

The ticket asks ten questions. Each answer below is a **position drawn in the file**, not a
decision — the decision is the design's, once somebody has looked.

### 1. Rows, prose, or both — **both, and they are not interchangeable**

Variants D and E are the same question asked two ways, and flipping between them makes the split
obvious: **D can only answer “which tickets”.** “What state is it in”, “what is stopping it”,
“did we already decide this” have no rows at all — D answers them with a list the reader still
has to read, which is the plain field with extra steps.

E answers all of them and answers none of them *in place*: the reader gets a paragraph and then
has to find the row themselves.

The position drawn: **prose is the answer, rows are the follow-through.** E's citations are the
join — the prose names the ticket, and pressing the number puts the reader on the row. D's
narrowing is a special case of that, worth having only where the answer really is a set.

### 2. What opens it — **the wand, at the trailing edge, with C as the live alternative**

Three findings from drawing it:

- **The leading edge is spoken for.** The magnifier is what says the control searches. A second
  mark there makes two claims about one field. At the trailing edge the wand sits where the clear
  button does — a thing you press, not a thing that labels.
- **The glyph is already taken.** `wand.and.sparkles` is `ArgoSymbol.skill`; in a Session feed it
  means a skill ran. Reusing it spends one glyph on two unrelated facts. That is a real cost, and
  it is the strongest argument the prototype found *against* the wand.
- **C costs no mark at all**, which is the one thing the room said must hold: one row of controls.
  Its risk is that detection is a guess — a short question reads as a term, a long term reads as
  a question, and a leading glyph flickering while somebody types is worse than either mode. The
  rule has to be conservative enough that the glyph is stable, which probably means *ends in a
  question mark, or six words and up*.

C is the more interesting shape and the riskier one. B is the one that can ship without a rule
nobody can tune.

### 3. Where the answer draws — **the ticket pane, as a sheet**

Four candidates, and each takes space from something:

| Draws in | Takes |
|---|---|
| the list pane | the tickets the reader asked about — self-defeating |
| the popover | nothing, but it is small, modal, and gone the moment you look away |
| the ticket pane | the open ticket, which is the pane the reader is *not* using while searching |
| a Session feed | the whole room |

The ticket pane wins because it already holds prose and because it is the pane a reader
searching the backlog has stopped reading. The cost is real and drawn: the open ticket goes
behind the sheet, so comparing the answer against it means closing one.

The popover (B) is fine for a one-line answer and too small for anything else. Drawn at 360
wide, three sentences fill it.

### 4. What the question can read — **the listing, and nothing the reader touched**

Stated on the answer itself, in every variant:

> Read **12 open tickets** — number, title, labels, priority, type, status word and the
> `blockedBy` edges the room already holds. No ticket body, no comments, nothing you clicked.

That is exactly `TicketsRoomProjection.Room` — what the room has already fetched. It reads
strictly more than the plain field (which takes the number and the title only) and strictly less
than a Session (which can `gh issue view` a body). The line is not a disclosure the reader has to
open: **an answer whose sources are hidden is an answer nobody can check.**

Bodies are deliberately out. #1293 warns that an answer depending on what the reader last clicked
is worse than no answer, and the same holds for one that depends on which bodies happened to be
cached. The listing is the same for every reader of the same view, which is what makes the answer
repeatable.

### 5. The honesty tier — **and it does not fit**

The ticket says the answer is CONVENTION at best. Drawing it turned that into a finding:

**None of the three tiers is right.** `docs/domain/honesty-tier.md` defines CONVENTION as
*arrived over the companion-plugin/MCP channel*. A backlog answer is not DIRECT (Argo did not
compute it), not DERIVED (nothing outside Argo asserted it — the model is not an authority being
read verbatim), and not CONVENTION (nothing came over the plugin). It is a fourth thing: **a
model's reading of facts Argo already holds.**

The file draws it as `CONVENTION` per the ticket's framing so the shape can be judged, but that
is the one label in here that should not survive review. Either the tier vocabulary grows a rung,
or the answer is defined as CONVENTION and the doc says why.

What *is* settled is how a reader tells it apart at a glance, and it is not the badge:

- **The answer never draws as the room's own prose.** It sits in a vessel with its own ground, a
  rule above it, and a foot that says what was read and what it cost.
- **The heading refuses the room's word.** D's last term reads `2 suggested`, never `2 results`.
  A result is arithmetic the room did; a suggestion is a model's. Those two words do more work
  than the badge does.
- **The count is never the room's count.** `TicketsChromeProjection` builds `n results` from
  `narrowing.matches`. A question must not reach that path.

### 6. What a wrong answer looks like — **checked, and drawn dead**

Two failures, and only one of them is survivable by design:

- **It names a ticket that does not exist.** Drawable and drawn (`state=wrong`). The room checks
  every number an answer names against the set it holds; one that is not there **draws as dead
  type, struck through, not a link**, with a stated notice under it. Nothing narrows. This is the
  most important guard in the whole prototype: a live-looking link to a ticket that does not exist
  is worse than any empty.
- **It misses one that does.** Not drawable, and that is the finding. There is no state that shows
  a reader what they were not told. The only honest mitigation is the `read` line — the reader
  knows it saw all twelve, so a miss is a miss and not a gap in what was fetched.

`state=empty` draws the third case, which is not a failure: nothing matched, said plainly, with
the nearest thing named. An empty answer is an answer.

### 7. What it costs and how long — **2–5s, and the list does not move**

Drawn in `state=waiting` for every variant. Three rules came out of it:

- **The list is never cleared while a question runs.** D dims it; nothing else touches it. A
  reader who asks a question and watches their tickets vanish has lost the thing they were
  looking at to a question that has not been answered yet.
- **The wait has a `Stop`.** Anything over a frame that cannot be stopped is a hang.
- **The elapsed time is stated after the fact** (`2.4s`), beside the Account. The plain field
  answers in one frame and says nothing; a question that took two and a half seconds should say
  so, because that is what tells a reader which of the two they just used.

F's cost is the honest outlier: `41s`, two `gh` calls, a Session, a room switch and a Turn.

### 8. Whether the plain query survives — **yes, except once**

The query is the Project's and survives a room switch. A question is an addition, so:

- **Opening a question does not clear the field.** B and D keep `chart` in it throughout; E keeps
  the whole list untouched, stated empty and all.
- **A question is not held.** It is not the Project's, it does not survive a room switch, and it
  does not appear in the heading's second line — the heading keeps reading `view · grouping ·
  count`, in that order.
- **The one exception is drawn** (`variant=E&state=followed`). Following a citation drops the
  query, because the answer names tickets the query had filtered out: the list cannot honour
  `chart` and show `#336` at the same time. Something has to give and it is the query. The field
  clears with it, so nothing on screen claims a narrowing that is not in force.

### 9. Which Account pays — **not the Ticket Binding, and the room has to say so**

`CONTEXT.md` L1: a **Binding** is a Project's use of one Account *through one port*. The GitHub
Binding on the Tickets port reads tickets. It does not answer questions about them — answering
spends a model, which is a different port and, normally, a different Account.

So a backlog question is paid for by the same Account a Session would spend, and the foot of the
answer names it (`GitHub · milad-alizadeh — 2.4s`; the provider is what was read, the Account is
who paid). **That naming is not decoration** — it is how a reader knows a question is not free.

`state=unbound` draws the case with no Account to pay: the wand still opens, and what it opens is
the refusal plus `Connect an Account…`. A dead glyph with a tooltip would be quieter and would
teach the reader nothing.

### 10. The empty room — **the wand is not drawn**

`TicketsChromeProjection.reading` already decides this and needs no new rule: the list-scoped
controls stand on `narrows`, which is `hasRows || narrowing != nil`. **The wand is a member of
that set.** No list, no question — there is nothing to ask about.

- **No provider connected** (`variant=B&state=vacant`): `TicketsRoomVacancy` replaces the whole
  deck, the row of controls is gone, and so is the wand. Drawn.
- **A provider that answered with nothing**: same rule via `narrows`, and the vacancy says the
  backlog is empty rather than unread.

## What must stay true, and whether it does

| The rule | Held? |
|---|---|
| The plain field keeps working, unchanged | Yes. A is untouched in every variant; the question is a second path. |
| The heading reads back the view, then the narrowing, in order | Yes. D adds a band *under* the heading rather than a third term inside it. |
| No matches stays a stated empty inside the list pane | Yes. Nothing here reaches for a vacancy. |
| The room stays one row of controls | Yes in B (the wand is inside the field's capsule), by construction in C and F. |
| A rail keeps its demotion | Yes. D's suggestions are hits; #607 and #334 are rails and keep #873's demotion. |

**One rule was nearly broken and the fix is worth recording.** The first draft marked a suggested
row with a leading accent rule. That is already ruled out — the ground alone carries selection
(#1165) — and it was also unnecessary: a suggestion is already told apart from a rail by the
demotion rails carry. The mechanism the room has was enough.

## What it is faithful to, and what it is not

It is **not** a component structure, a projection, or anything to port line by line. The rig
around the window — the slug, the caliper under it, the switcher — is deliberately achromatic,
because every hue in view belongs to the specimen and a coloured pip in the furniture would read
as one of Argo's state inks.

The prose in the answers is written, not generated. It is there to show how long an answer is and
how it reads, not to promise what a model would say.
