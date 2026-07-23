# App shell spec

> Wayfinder #172, part of #157. The shell that hosts every room. This is a **written
> spec**, not a pixel study — the visual source of truth is the existing settled room
> prototypes (`cockpit-session-interior-prototype.html` #161, `cockpit-work-room-prototype.html`
> #185, `cockpit-penumbra-reference.html` #158). This doc owns only what no room file owns:
> the **canonical chrome**, the **navigation + keyboard/command model**, and the shell's
> **connective tissue** (empty-shell seam, spawn, cross-surface nav). Everything else it
> *references* rather than re-specifying. Look/density are Phase 2/per-surface — not settled here.

## Scope

**Owns:** the assembled chrome and its consistency across rooms; the navigation/IA between
surfaces; the keyboard/command model; the empty first-run shell (the seam before onboarding);
spawn (where a new session comes from and lands); how a finished session leaves the roster.

**References, does not re-spec:** onboarding flow → #165 · provider connect/state → #167 ·
session interior + delivery/merge → #161 · work-room interior → #160/#185.

## Canonical chrome

Four fixed regions, one lit Penumbra scene (#158). Carried from the room prototypes; the
points below are the reconciled canonical form all rooms conform to.

- **Project strip** — far-left, ~60px. One tab per connected project; **one worst-state dot
  per project** (amber needs-you > red failed > green running > none), active project stays
  quiet (#164). `+` adds a project. Swap = **view change, not teardown** — sessions keep
  running, per-project UI state is remembered on return, the Preview singleton survives (#164).
- **Top brow** — `ARGO` mark + active project name (left); **room tabs** (center); global
  counters + the **Commands ⌘K** affordance (right).
- **Room tabs** — `Sessions ⌘1` · `Work ⌘2`. **Sessions is the home/default (⌘1)** — you land
  in the running world; Work (the backlog) is entered deliberately. The room switch survives;
  the Concierge strip persists across it (#159).
- **Global Concierge strip** — fixed **bottom, full width**, ~56px. Cheap CSS ring-orb
  (always-on) + live caption + conversation-mode toggle (#159). **Chrome/seat only here** —
  the Concierge's behaviour and data model are owned by map #190, out of scope for #157.

## Navigation & keyboard / command model

Two layers, both first-class:

1. **Direct manipulation is the floor** — every action is a visible, clickable affordance
   (project dots, room tabs, roster rows, primary buttons). Nothing is keyboard-only.
2. **⌘K command palette is the power spine** (in v1, additive over the floor) — search + run
   any command, jump to any session / ticket / project, spawn, transition. It is also the
   **searchable index** that scales the shell past a handful of sessions/tickets, and the
   natural text-command sibling to voice. Cheap even under the low-spec constraint.

### Canonical keymap

| Key | Action |
| --- | --- |
| `⌘1` / `⌘2` | Sessions room / Work room |
| `⌘[` / `⌘]` | Previous / next project |
| `⌘K` | Command palette (search + commands + jump) |
| `⌘N` | Spawn a session |
| `⌘⏎` | Primary action in context (e.g. Implement in Work) |
| hold `⌘␣` | Talk to the Concierge (seat only; behaviour = #190) |
| `Esc` | Back / dismiss / close palette |
| `↑` `↓` + `↵` | Move within a list · open the selection |

## Connective tissue (the through-line)

The shell owns the seams *between* the settled surfaces, not the surfaces themselves.

- **Empty / first-run shell** — no project connected yet: the strip shows only `+`, the stage
  hosts a single "connect a provider to begin" seam that **hands off to #165's onboarding
  flow**. The shell renders honestly empty; it does not fake content. (Full onboard UX = #165.)
- **Spawn** — reachable from `⌘N`, the ⌘K palette, and the roster's spawn affordance. A new
  session is created in the **active project** and lands in the **Sessions roster** as the
  active (driven) session. (Spawn is owned here because no other ticket owns it.)
- **Cross-surface navigation** — project → room (`⌘1/⌘2`) → drill into a roster row or backlog
  ticket → `Esc` returns to the room. Drilling never leaves the shell; the chrome persists.
- **Session exit** — a merged / archived / finished session leaves the active roster and moves
  to Archived (opened as a list, per #161). The roster shows the live world by default.

## Graceful degradation

Per the map's cross-cutting requirement, across the honesty tiers:

- **Nothing connected (DIRECT)** — empty shell + connect seam (above); no roster, no counters,
  the strip is just `+`. Honest empty, never fabricated.
- **Provider connected (DERIVED)** — projects, worst-state dots, backlog, and delivery facts
  populate from provider + git/code-host reality.
- **Companion plugin (CONVENTION)** — CONVENTION-tier session facts (labels, groups, status)
  enrich the roster and Concierge caption. Absent, the shell degrades down, hiding whole
  rather than faking a word.

## Follow-up

- **Reconcile `cockpit-session-interior-prototype.html`** — its room tabs currently read
  `⌘1 Work · ⌘2 Sessions`; correct to the canonical `Sessions ⌘1 · Work ⌘2`. A trivial
  prototype edit, folded in whenever that file is next touched (not its own ticket).
