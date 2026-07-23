# Cockpit status vocabulary — the canonical word registry

The master list of **status words**: the small fixed set that names *what state a
thing is in*. Companion to `cockpit-domain-model.md` (CONTEXT.md — entities) and
`cockpit-surface-matrix.md` (what shows when). Resolves wayfinder #174.

**The one rule:** a state has exactly **one word**, and that word is **identical
everywhere it appears**. If the Roster says `running` and the session Header says
`active` for the same session, that is a bug. Surfaces vary *how much* they show
(Roster = one word; Header = word + meta) but never *which* word.

**Scope of #174 — content split three ways (grilled + settled):**
1. **Status vocabulary** (this doc) — a shared type system, one canonical registry,
   decided now.
2. **Microcopy + empty-state copy** — surface-local; harvested per-prototype into
   each surface spec as that prototype settles. **Not** centralized here.
3. **Concierge narration** — deferred. Concierge is v1-unbuilt (only the orb visual
   exists — CONTEXT.md); its narration script is owned by #176 when that lands.

## Two ownership classes

Who gets to *name* a state depends on who *derives* it:

- **Argo-owned words** — states Argo itself derives (Session liveness, Attention,
  Delivery lifecycle, Check, Review). Argo has no upstream to defer to, so it fixes
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

State carried by the **dot colour** (#164 / session-interior B4); the word stays
neutral dim text — no coloured words, no double-encoding.

| State | Word | Dot | Notes |
|---|---|---|---|
| Running | `running` | green, live glow | the normal state with 3–4 sessions; liveness stays legible under attention |
| Idle | `idle` | dim grey | agent alive, not currently working |
| Needs you | `needs you` | amber/gold | the one attention state (#164) — a "come here", not a calm state |
| Failed | `failed` | red | crash / canceled / `stopped`→red; a "come here" signal, hue-distinct from needs-you |
| External | *(identity, no state word)* | hollow | observed non-managed session; status degrades away, not faked |

- **Roster = one word** (R16): the single most decision-relevant word for the row.
  **A Delivery claim beats session status** — a row mid-delivery shows the delivery
  word (e.g. `CI failed`), not `running`.
- No `Resume`, no `Relaunch` as states (session-interior) — Relaunch exists only as
  an action for a dead PTY, never a status word.

## Attention (Argo-owned)

One flat state, not a subsystem (#164). It **is** the amber `needs you` above at the
session level. Rolled up:

| Surface | Reads |
|---|---|
| Project strip icon | single **worst-state** dot: amber (needs you) > red (failed) > green (running) > none; active project stays quiet |
| Roster row | the session's own dot (above) |

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

## Honesty tier (attribute, not a user word)

`DIRECT` / `DERIVED` / `CONVENTION` (#182/ADR-0016) label the *provenance* of a
rendered fact; they are an internal attribute, **not** status words shown as text.
How a tier surfaces visually (a dimmed treatment, a tilde on an estimate like the
ctx ring's honest `~38%`) is a per-surface rendering decision, not a word in this
registry.

## Empty / degraded — where words come from

Empty-state and error **copy** is surface-local (harvested per-prototype), but its
*words for states* obey this registry. When a whole tier is unavailable, the surface
**hides whole** (surface matrix) rather than showing a half-filled skeleton or a
faked word — e.g. no provider → no Work Item status words at all; external session →
CONVENTION-tier words absent, their sections hide.
