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

Every state the ticket lists is addressable by URL, which is the point — a state you cannot
link to is a state nobody re-checks. The caption above the switcher says what each one is.

**It is drivable, not only viewable.** Typing works and the field grows; `⏎` sends and `⇧⏎`
makes a line; a real `⌘V` adds a chip; dragging a file over the composer shows the drop state;
`⏎`/`esc` answer a pending Permission. That matters because the questions here — *how does
multi-line read at this density, is 40pt enough of a drop target* — are answered by using it,
not by looking at it.

### The states

**Composing** — `rest` · `typing` · `ceiling` · `sent` · `running` · `queued` · `draft`
**Run settings** — `run` · `run-effort` · `run-ask`
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

Four things B added after the first pass:

1. **The send control is an arrow in a circle and nothing else.** The word *Send* beside an
   arrow beside a `⏎` hint is the same instruction three times.
2. **One run-settings pill in the footer row**, opening a menu of **Model · Mode · Effort**
   with *Reset to default* under a rule.
3. **The pill's summary leads with Mode**, then Model, then Effort. Model and Effort are the
   CLI's own knobs; **Mode is Argo's standing autonomy stance**, and it is the one that decides
   how often the agent stops to ask you something — so it is never a value you have to open a
   menu to read. A non-default Mode colours in the pill (`Ask` takes the attention ink).
4. **The container is native glass, not a tinted panel** — the ground shows through, the rim is
   a light source rather than a border, and the vessel sits on its own halo.

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
7. **Mode does not belong in a menu with Model and Effort, even though it opens from the same
   pill.** The three sit together because they are all *how this Session runs*, but only Mode
   changes how often you are interrupted — burying its value one click deep would blur the
   Mode/Permission distinction `CONTEXT.md` insists on. Hence: all three in the menu, Mode
   first and always visible in the summary.

## What it is not

Not a component structure, not a state machine, not anything to port line-by-line. Settling it
into the app is `componentize-design`'s job, on #535's implementation tickets. This only shows
what those must produce.
