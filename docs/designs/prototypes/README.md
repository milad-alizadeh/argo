# Roster row + Session header — throwaway prototype

**This branch is a primary source, not a starting point.** It exists so the decisions in
[#502](https://github.com/milad-alizadeh/argo/issues/502) can be *looked at* rather than read.
It is deliberately not on `main`: it was written under prototype constraints — no tests, no
abstractions, one file — and the validated decisions live in the spec, not here.

> `docs/designs/README.md` records that HTML studies were retired from the committed design set
> when the runtime locked to Swift (ADR-0022). This is not a re-opening of that: it is a
> throwaway on a throwaway branch, which is where the `prototype` skill puts them.

## Run it

Open `roster-header-prototype.html` in a browser. No build, no server, no dependencies.

```sh
open docs/designs/prototypes/roster-header-prototype.html
```

## The question it answered

*What should the Sessions roster row and the Session deck header show?*

Both were re-opened from scratch. The roster row's content had shipped; the header had never
been built (`DeckZone.header` still renders `Session header · placeholder`). The prior content
lists in `cockpit-spec.md` §4.1/§4.2 and D30/D31 were treated as one prior proposal rather than
as settled.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which header layout. Also `←`/`→`, or the floating bar at the bottom. |
| `&s=<session id>` | Select a Session directly, e.g. `&s=32c9e59a` for the over-capacity one. |
| `&i=1` | Open the ⓘ context panel on load. |
| `&d=1` | Open the Project drawer on load. |
| `#swiped` | Leave a roster row swiped open, so the Archive affordance can be screenshotted. |

Every state in #502 is reachable by URL, which is the point — a state you cannot link to is a
state nobody re-checks.

## The three header variants

- **A — fact strip.** Title with a quiet fact line beneath it; the context reading and its bar in
  a fixed 200px column on the right; usage and duration on the tab line. **This is the one the
  spec is written against.**
- **B — context medallion.** A 40pt conic ring on the left as the instrument, everything else as
  chips beside the title. Costs the title real width inside a 56pt band.
- **C — budget spine.** The context bar becomes a full-width rail across the top of the deck;
  facts as bordered chips. Reads as an alert bar rather than an instrument.

The roster row differs per variant too — A is two lines, B one dense line, C branch-first — which
is how the row's truncation behaviour under real branch names got compared.

## The data is real

The seven Sessions are read off this machine (2026-08-10), not invented:

- **Titles** derived from each transcript's opening prompt.
- **Context** = the last turn's `input + output + cache_read + cache_creation`.
- **Tokens used** = the same, summed across every turn.
- **`started … ago`** = wall-clock from the transcript's first record to its last. Not "last seen":
  a running Session was last seen now. **`worked`** = the sum of gaps under five minutes;
  anything longer is the user away from the keyboard, not an agent thinking.
- **Branches and worktrees** from `git worktree list`.
- **Projects** from the real registry — including `argo-plugin`, which has sessions on record but
  no folder on disk, so it renders ghosted with `Locate…`.

**Only two things are assigned rather than read:** the liveness states and the managed/external/
orphaned posture. A transcript at rest reads `idle`, and the renderings need all five states.
Everything else is a real value.

### What using real data exposed

Three decisions came from the data and would not have come from invented fixtures:

1. **Subagent spend is not attributable.** Checked in both places `CONTEXT.md` says it lives —
   `message.usage` on sidechain records, and `toolUseResult.usage` on the delegating Tool Call —
   and every real session reports zero. The header therefore *omits* the figure rather than
   rendering `0 subagents`, which would claim none ran.
2. **Real branch names overflow the row.** `worktree-ticket-375-graphite-ion-blue` does not fit a
   320pt sidebar. The branch ellipsizes so the chips after it survive.
3. **`ran` and `worked` differ by 5–8×** on a long session (9h 25m vs 1h 35m). Either number alone
   is read as the other, so both are shown.

## Decisions this prototype settled

Recorded in full in #502. In brief:

- The roster row is a **switcher** — identity, not a triage queue: title, branch, and an age
  worded `2m ago`, since a bare `2m` is read as a duration.
- **`Stopped`**, not `Failed`: `SessionStatus.stopped` means the Turn ended on `max_tokens`,
  `max_turn_requests` or `refusal` — stopped short, not crashed.
- **Archive is manual only** and reveals on swipe-left, icon only.
- Context is **tokens against the window** with two Argo-owned lines at 150k and 300k.
- **Hand off** appears past 150k, managed only, and carries no caption.
- The ⓘ panel **explains**; it does not repeat the reading beside it.

## What it is faithful to, and what it is not

Every colour, radius, spacing step and type role is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` — `GraphitePalette`, `ArgoGeometry`,
`ArgoLayout`, `ArgoTypography`. Nothing is invented. The shell around it (full-height sidebar,
transparent titlebar, scope vessel, Rooms) was corrected against a screenshot of the running app,
not against the design docs.

**Type is San Francisco throughout**, which D24 and D31 now say too — `ArgoTypeface` has only
`interface` and `machine`, and the app draws SF everywhere. Their New York prose was corrected
by #504; it is not something to reinstate from an older read of the decision log.

It is **not** a component structure, a state machine, or anything to port line-by-line. The
projections in #502 are the real design; this only shows what they must produce.
