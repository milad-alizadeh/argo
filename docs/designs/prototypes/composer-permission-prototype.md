# Composer, attachments and Permission — throwaway prototype

The design study for [#536](https://github.com/milad-alizadeh/argo/issues/536), under
[#535](https://github.com/milad-alizadeh/argo/issues/535) / ADR-0024.

## Run it

```sh
open docs/designs/prototypes/composer-permission-prototype.html
```

## The question it answered

*The composer replaces the terminal as the way a user speaks to a Session. The port beneath it
is decided (ADR-0024); what the surface looks like is not.* Nothing in the decision log or the
approved study covers a composer, an attachment chip, or a Permission prompt — the study was
drawn when the Dock held a terminal.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which composer, and where Permission appears. Also `←`/`→`, or the floating bar. |
| `&state=<key>` | Which state. Also `↑`/`↓`, or the picker in the floating bar. |
| `&f=1\|2` | Where Model and Effort sit (variant B only). The ⚙ picker in the floating bar. |

Every state the ticket lists is addressable by URL, which is the point — a state you cannot
link to is a state nobody re-checks. The caption above the switcher says what each one is.

**It is drivable, not only viewable.** Typing works and the field grows; `⏎` sends and `⇧⏎`
makes a line; a real `⌘V` adds a chip; dragging a file over the composer shows the drop state;
`⏎`/`esc` answer a pending Permission. That matters because the questions here — *how does
multi-line read at this density, is 40pt enough of a drop target* — are answered by using it,
not by looking at it.

### The states

**Composing** — `rest` · `typing` · `ceiling` · `sent` · `running` · `queued` · `draft`
**Run settings** — `run` · `run-model` · `run-ask` · `run-plan`
**Attachments** — `attach` · `dragover` · `paste` · `noattach`
**Permission** — `perm` · `perm-edit` · `expired`
**Degraded** — `external` · `orphaned` · `failed`

## The answer: variant B

**B was chosen (2026-08-10)**, so the page opens on it. A and C stay as the record of what it
was chosen against — they are not maintained beyond that.

**The Dock does not survive.** It promised a Session terminal and there is no longer one to
hold; B replaces it with a vessel that floats over the feed rather than sitting in a seam, so
the deck's bottom edge belongs to the feed again. The Dock as a concept goes with #535's
terminal.

Three things B added after the first pass:

1. **The send control is an arrow in a circle and nothing else.** The word *Send* beside an
   arrow beside a `⏎` hint is the same instruction three times.
2. **The container is native glass, not a tinted panel** — the ground shows through, the rim is
   a light source rather than a border, and the vessel sits on its own halo.
3. **Model, Mode and Effort are selectable**, in the app's own vocabulary rather than the
   reference apps' — see below.

## Run settings — a second axis, `&f=1|2`

Every agent app puts a grey capsule with a chevron next to the send button and drills down
through *Model → · Effort → · Reset to default*. Copying that shape says nothing about this app.

**These are all stock AppKit/SwiftUI controls, and the implementation must not build bespoke
ones.** The prototype's CSS exists only so the arrangement can be judged:

| In the study | In the app |
|---|---|
| `.seg` (Mode, Effort) | `Picker(…).pickerStyle(.segmented).controlSize(.small)` |
| `.menupick` (Model) | `Picker(…).pickerStyle(.menu)` — a plain pop-up button |
| `.runpanel` | `.popover(…)` with `.presentationBackground(.regularMaterial)` |
| the panel's rows | `Form` / `LabeledContent` — label leading, control trailing |

**Mode lives on the composer footer and is never repeated in the popover.** It is the one of
the three that decides how often the agent stops to ask you something, so it must be readable
without opening anything — and once it is on the footer, restating it inside is the same fact
twice. `Ask` takes the attention ink and `Plan` the accent, because both are departures from
acting autonomously.

The popover therefore holds exactly what the footer does not say: **Model** as a pop-up button
over a list of names, and **Effort** as a segmented picker because it is an ordered scale rather
than a set of equals. **Reset** names what it resets *to* — `Reset to Code · Opus 5 · Medium` —
instead of saying "default" and making you open it to find out.

The two treatments differ in where Model and Effort are read and set:

| `&f=` | Composer footer | Deck header |
|---|---|---|
| **1** | Mode segments + a `Sonnet 5 · High` fact line opening the popover | unchanged |
| **2** | Mode segments only | `Claude Code · Opus 5 · Medium`, clickable, popover drops below |

**2 is the quieter of the two**: the header is already where a Session's standing facts live, so
Model and Effort join the line that states the CLI, and the composer keeps only the setting you
change mid-session.

> **Proposal against the token contract:** the vessel's **18px radius** is not in
> `ArgoGeometry` (`r-popover` is 12). A vessel this wide reads as a dialog at 12. Promoting it
> is a contract change through `setup-design-foundations`, not a constant dropped into a view.

## The three variants

They disagree about **two** things at once — where the composer lives, and where a Permission
prompt appears — because the second answer depends on the first.

- **A — attached seam.** The composer takes the Dock's own position and its 40pt height at
  rest, flush to the deck's bottom edge, growing upward into the deck as you type. The feed's
  bottom edge is always the composer's top edge, so nothing is ever hidden behind glass.
  **Permission renders inline in the feed**, indented to the value column, at the Tool Call
  that raised it.
- **B — floating glass vessel. ✓ chosen.** A native-glass capsule floating over the feed; the
  feed runs under it and fades. The field is the whole top; attach, the run-settings pill and
  the send arrow are one footer row under it. **Permission takes the composer's own slot** —
  the vessel becomes the prompt, so there is exactly one input surface and it always holds
  whichever question is live.
- **C — docked panel with a toolbar.** An always-multi-line panel with its own toolbar row
  (attach, adapter chip, send). Generous by default: it says *write something considered* rather
  than *type a line*. **Permission is a sheet** over the deck only — the roster stays legible
  behind it, so the other Sessions are still readable while one blocks.

## What the states are faithful to

The Sessions are the same real ones read off this machine for #502 (2026-08-10) — titles
derived from each transcript's opening prompt, branches from `git worktree list`. Only liveness
and the `managed | external | orphaned` posture are assigned, because the renderings need states
a transcript at rest does not have.

The degraded states are shown **on Sessions that are genuinely in that posture** — `external`
on the Codex worktree Argo never spawned, `orphaned` on the worktree whose owner died. A
degradation mocked onto a healthy Session is a picture, not a render.

## Things the prototype settled by being built rather than argued

1. **A 40pt seam is a poor drop target.** Variant A matches the Dock's height exactly, which
   reads well at rest and badly with a file over it — the drop wash is a 40pt strip across the
   bottom of the window. B and C have room for the gesture.
2. **Acceptance wants no toast.** The field clearing, the words appearing in the feed as the
   user's own, and the status flipping to *Running* are three signals already. A fourth is
   noise. The prototype flashes a 1.4s accent wash on the new row instead, which is the same
   information at the place it happened.
3. **"Expired" has to be its own word.** Rendering an unanswered Permission as *denied* claims
   a decision nobody made. The feed says `Permission expired after 5m — denied, unanswered`,
   and the agent's own prose follow-up sits under it.
4. **The patience window is worth drawing.** The hook's `timeout` is a real clock, so the prompt
   carries a fuse and `denies in m:ss`. Without it, walking away looks free. (It runs at 45s here
   so expiry can be watched; the real value is minutes.)
5. **A degraded composer should be absent, not disabled.** A greyed field still invites a click
   and gives no reason. One line saying *read-only — Argo did not spawn this Session* answers
   the question the field would have raised.
6. **A failed send must not clear the field.** The message stays where it was typed, with the
   reason and a Retry on the seam.
7. **A setting that is visible on the surface must not also appear in the popover that opens
   from it.** Mode on the footer *and* Mode in the panel reads as two controls for one value,
   and the second one is the one you distrust. Putting Mode outside is what makes the popover
   small enough to be two labelled rows.

## What it is not

Not a component structure, not a state machine, not anything to port line-by-line. Settling it
into the app is `componentize-design`'s job, on #535's implementation tickets. This only shows
what those must produce.
