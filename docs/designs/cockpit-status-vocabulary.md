# Cockpit status vocabulary — the canonical word registry

> Wayfinder #174, part of #157. The master list of **status words**: the small fixed set that
> names *what state a thing is in*. Companion to `CONTEXT.md` (the domain model — entities) and
> `cockpit-surface-matrix.md` (what shows when). Amended by #173 (the connection block, and the
> narrowing of "Empty / degraded"); landed by #205.

**The one rule:** a state has exactly **one word**, and that word is **identical
everywhere it appears**. If the Roster says `running` and the session Header says
`active` for the same session, that is a bug. Surfaces vary *how much* they show
(Roster = one word; Header = word + meta) but never *which* word.

**Scope of #174 — content split three ways (grilled + settled):**
1. **Status vocabulary** (this doc) — a shared type system, one canonical registry,
   decided now.
2. **Microcopy + empty-state copy** — surface-local; harvested per-prototype into
   each surface spec as that prototype settles. **Not** centralized here.
3. **Concierge narration** — **out of scope of #157 entirely.** #174 deferred it to #176;
   #176 was subsequently closed as out of scope and the Concierge, wholesale, moved to its own
   effort ([#190](https://github.com/milad-alizadeh/argo/issues/190)). Narration words are
   decided there, against this registry.

## Two ownership classes

Who gets to *name* a state depends on who *derives* it:

- **Argo-owned words** — states Argo itself derives (Session liveness, Attention,
  Delivery lifecycle, Check, Connection). Argo has no upstream to defer to, so it fixes
  the word. **The tables below are the authority.**
- **Provider-owned words** — the **Work Item status**, which is purely
  provider-sourced (#167 discipline: never synthesized from local facts). The word
  the user reads on a ticket is the **provider's native word, verbatim** (GitHub
  `Open`/`Closed`, Linear `In Progress`/`In Review`/`Done`, …). Argo's **canonical
  five** (#167) is the *internal bucket* used for ranking, filtering, and
  transitions — it is **never** shown in place of the provider's word. Argo chrome
  that must group across providers (a filter pill, a Next-up reason chip) uses the
  canonical bucket label; the ticket itself always shows its provider word.

  *Why not one Argo word everywhere?* Consistency here means **deterministic and
  honest**, not uniform: showing GitHub's own `Open` beside GitHub is more truthful
  than overwriting it with our `todo`, and the mapping (state-map, #167) is fixed
  and legible. Uniformity would *lie* about what the provider says.

## Session status (Argo-owned)

State carried by the **dot colour** (#164 / session-interior B4), and on the roster row
by a **badge** beside the title: the word uppercase and tracked at `ArgoTypography.badge`
(10, semibold), in the dot's own ink. One treatment for that slot, so `NEEDS INPUT` and
`STOPPED` are the same size of claim — and the same role the Permission prompt's own
`PERMISSION` takes, which is the size both measure in `composer/perm.png`
(`cockpit-session-composer.md`, decision 10).

The **deck header says the same word in sentence case**, because it is a line of the
header's own prose rather than a mark in a column.

> Corrected in build (#544). This read *the word stays neutral dim text — no coloured
> words, no double-encoding*. Both approved renders draw the word in the state's ink, and
> #502 shipped it that way: the roster's amber row is the one thing on the surface asking
> to be looked at, and a dot alone at 6pt is not legible enough to carry it. The dot and
> the word are one claim in two channels, not two claims.

| State | Word | Dot | Notes |
|---|---|---|---|
| Running | `running` | green, live glow | the normal state with 3–4 sessions; liveness stays legible under attention |
| Idle | `idle` | dim grey | agent alive, not currently working — **and the honest reading of an agent's free-form question**, which the record cannot tell apart from idle |
| Needs input | `Needs input` | amber/gold | the one attention state (#164) — a "come here", not a calm state. **Two domain states share this one word** (`CONTEXT.md` L2): `permission` (blocked on a permission prompt, DIRECT and managed-only) and `asking` (blocked on a structured question). Which flavour of "come here" it is would be a second telling, so the row never spells it. It names **what the Session is waiting for**, not who it wants (#507, superseding `needs you`) |
| Stopped | `Stopped` | red | `stopped` only — a Turn that ended on `max_tokens`, `max_turn_requests` or `refusal`: the agent stopped short. **Not `Failed`** (#507): nothing crashed, and a cancelled or exited Session is `ended`, which reads idle |
| Ended | `ended` | dim grey | the session terminated. Needs a process exit Argo witnessed, so an external session floors above it at `idle` rather than claiming a shutdown it never saw |
| External | *(identity, no state word)* | hollow | observed non-managed session; status degrades away, not faked. **`orphaned`** — a managed session whose owning Argo process is gone — renders the same way: it is a posture on the `managed \| external` axis, not a state word |

- **Roster = one word** (surface matrix, Session status row): the single most
  decision-relevant word for the row. **A Delivery claim beats session status** — a row
  mid-delivery shows the delivery word (e.g. `CI failed`), not `running`.
- No `Resume`, no `Relaunch` as states (session-interior) — Relaunch exists only as
  an action for a dead PTY, never a status word.
- The dot follows **liveness**, not observation success: a transcript Argo cannot parse
  renders `unknown` on the affected fact and leaves the dot alone (`cockpit-failure-states-spec.md` §8).

## Attention (Argo-owned)

One flat state, not a subsystem (#164). It **is** the amber `Needs input` above at the
session level. Rolled up:

| Surface | Reads |
|---|---|
| Project strip icon | single **worst-state** dot: amber (needs input) > red (stopped) > green (running) > none; active project stays quiet |
| Roster row | the session's own dot (above) |
| Dock badge / OS banner | the out-of-window projection of the same dot — amber + red only, verbatim words (#188) |

Connection health **never** enters this channel (`cockpit-failure-states-spec.md` §2).

## Work Item status (provider-owned — word is read-through)

The **displayed word is the provider's**, shown verbatim. The canonical five is the
internal bucket only.

| Canonical bucket (#167) | Meaning | Example provider words shown |
|---|---|---|
| `todo` | not started | GitHub `Open`, Linear `Todo`/`Backlog` |
| `in-progress` | actively being worked | Linear `In Progress`, Jira `In Progress` |
| `in-review` | provider workflow status **read-through only** — never synthesized from a local PR/Delivery | Linear `In Review` |
| `done` | completed **successfully** | GitHub `Closed (completed)`, Linear `Done` |
| `closed` | terminated **without** completing | GitHub `Closed (not planned)`, Linear `Canceled` |

- **`done` vs `closed` are distinct and both kept** (#167). A bare tracker exposes
  only `todo`/`done`/`closed`; the `in-progress`/`in-review` words appear only when
  the provider's workflow carries them (two degradation tiers, #167).
- **Discipline:** a running session does **not** make a Work Item `in-progress`; an
  open PR does **not** make it `in-review`. Those are separate axes (Session
  liveness / Delivery review).

## Delivery lifecycle (Argo-owned)

Node states along the rail `commits — pr — ci — review — merge` (surface matrix
5–9). Glyph shorthand is provisional; visual treatment settles in Phase 2.

| Node | States (words) | Glance glyph |
|---|---|---|
| Commit | `N dirty` · `committed` · `clean` | `● N dirty` / `◆` / `✓` |
| PR | `no PR` · `PR #42 → main` · `draft` | anchor `PR #42 → main` |
| CI | `running` · `passing` · `failing` (+ `N running`/`N failed` aggregate) | `● 1 running` |
| Review | agent: `approved` · `changes requested` · `N findings`; human: `approved` · `changes requested` · `pending` | verdict + summary (never verdict alone) |
| Merge | `blocked` · `ready` · `landed` | gate `◆ [Merge #42]` / `Landed · sha` |
| Deploy | *deferred* | — |

- **No free-text status string** (session-interior C-line): "CI running" / "review
  pending" are implicit in the rail's live/wait nodes, `1 blocking` = a red badge on
  the Review tab, file count = `Files (N)`. The rail *is* the status readout.
- **Check** word set (per-check rows in the CI drawer): `running` · `passed` ·
  `failed` · `skipped` · `neutral` — mirror the code host's own check conclusions
  (DIRECT/DERIVED), host vocabulary preserved.
- Delivery **never** fires an OS notification (#188) — it is provider-polled, and a banner
  would read as `DIRECT`.

## Connection (Argo-owned)

Added by #173. Staleness is a property of the **connection**, never of an individual fact —
there are no per-fact staleness badges. All of these roll up into the **one brow chip** in the
top bar's right cluster (`cockpit-app-shell-spec.md`, placed by #201), which is **silent when
healthy**: there is no green light.

| Thing | Words | Notes |
|---|---|---|
| Connection | `stale` · `needs reconnect` | healthy renders **no word**; `needs reconnect` routes to the reconnect flow (#165) |
| Cause | `offline` · `unreachable` · `rate limited` | not states — they appear *inside* the `stale` chip, beside the age |
| Project integrity | `folder not found` | not a connection failure: the whole project is disabled (Relocate / Remove), §6 |
| Unestablishable fact | `unknown` | rendered **on the fact** when observation fails or degrades; never reddens a dot, never a default value |

- Writes stay live while `stale`; they disable only on `needs reconnect` (§7).
- Account-level auth failure escalates **past** the roll-up; `last synced` lives on the active
  project tab's hover tooltip (#201), not in the chip.

## Honesty tier (attribute, not a user word)

`DIRECT` / `DERIVED` / `CONVENTION` (#182/ADR-0016) label the *provenance* of a
rendered fact; they are an internal attribute, **not** status words shown as text.
How a tier surfaces visually (a dimmed treatment, a tilde on an estimate like the
ctx ring's honest `~38%`) is a per-surface rendering decision, not a word in this
registry. Onboarding (#165) confirmed the rule at the other end: an on-screen tier
ladder was cut in favour of plain benefit copy.

## Empty / degraded — where words come from

Empty-state and error **copy** is surface-local (harvested per-prototype), but its
*words for states* obey this registry.

- **Tier axis — hide whole.** When a whole tier is unavailable, the surface **hides whole**
  (surface matrix) rather than showing a half-filled skeleton or a faked word — no provider ⇒ no
  Work Item status words at all; external session ⇒ CONVENTION-tier words absent, their sections
  hide.
- **Freshness axis — keep and label.** `hide whole` governs the **tier** axis **only**
  (`cockpit-failure-states-spec.md` §1). Successfully-fetched data that has gone **stale** stays
  rendered at full fidelity, with the connection words above carrying the age — the data is old,
  not wrong. Blanking on a failed poll would erase your backlog over a dropped packet.
- **Fact-level failure — `unknown`.** A fact that cannot be established honestly renders
  `unknown` rather than a default (§8).
