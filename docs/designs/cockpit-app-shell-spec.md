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
spawn (where a new session comes from and lands); how a finished session leaves the roster;
**out-of-window attention** — OS notifications and the dock badge (#188).

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

**Failure is a different axis, specced elsewhere.** The tiers above cover *never established*.
What happens when a fact **was** established and goes bad mid-flight — stale connections, the
brow's connection chip, rejected writes, a vanished project folder — is owned by
`cockpit-failure-states-spec.md` (#173). The chip's placement and rendering land via #201.

## Out-of-window attention (OS notifications)

> Wayfinder #188. Owned here because the notification channel is shell-level connective
> tissue — it belongs to no room, and it is the only part of the attention model that renders
> outside the window. **macOS is the v1 target**; other platforms get banners only.

**The governing rule: an OS notification is the out-of-window projection of the session dot.**
It is not a notification *subsystem* — it introduces no state, no vocabulary, and no ranking of
its own. Every property below is derived from #164's four-state dot, which is why external
sessions and blind observation need no special-casing: they cannot honestly reach the firing
states, so they cannot fire.

- **Fires on** a session entering **amber `needs you`** or **red `failed`** — exactly the set
  that lights a project-strip badge (#164). **Never on `idle`**, including a clean `end_turn`:
  `idle` deliberately earns no badge, so notifying on it would invent an interrupt with nothing
  in-app to answer or clear — and a session goes idle after *every* turn.
- **Suppressed whenever any Argo window is focused.** The in-app channel is sufficient then:
  a background project going amber lights its strip dot, which is always visible and is exactly
  the surface #164 created for the sessions you cannot see. **Regaining focus closes outstanding
  banners** — you are here now, and the dots are authoritative. OS Do Not Disturb / Focus is
  honoured by never overriding it; there is no in-app quiet-hours.
- **One live banner per session.** Dedupe on `(sessionId, state)` — one per entry into a state,
  no re-fire while it sits there. amber→red **replaces** (Electron has no tag/replace, so main
  holds the objects and closes them itself); leaving the state **clears** it. **No burst
  coalescing** in v1: amber comes from a human-shaped event, not a poll, so simultaneous arrival
  is rare, and macOS already groups per-app. A threshold collapse (`3 sessions need you`) is
  purely additive later.
- **Dock badge = count of amber + red across all projects** (`app.setBadgeCount`), the same set,
  keeping one definition of "needs you" across dot, badge, and banner. **Focus-independent** —
  banners are interrupts that focus answers; the badge is a state readout and stays until the
  sessions actually leave those states. A *count*, not a dot, because unlike the project strip
  (worst-state, no counts, per-project dots underneath) the dock icon is a single global object
  with nothing underneath it.
- **Click deep-links**: focus → swap to that session's project → `Sessions ⌘1` → select and open
  that session. The payload carries `(projectId, sessionId)`; main→renderer needs a
  navigate-to-session command, the same one ⌘K's jump requires. This **overrides remembered
  per-project UI state** for that swap — #164 restores room/selection on return, but an explicit
  deep-link is a fresh instruction and wins. Clicking a banner for a session that has since gone
  green still deep-links; landing on it is honest, not an error.
- **No in-app toggle and no sound control.** macOS's per-app notification settings already
  separate banner from sound from badge — better granularity than we would ship, and where a Mac
  user looks first. A Preferences surface existing only to hold one boolean would be this map's
  first surface that exists for a setting rather than for work. Accepted cost: the OS permission
  prompt appears at first send with no in-app framing, and a denial is recoverable only in System
  Settings (onboarding copy may mention it — a copy amendment, not a surface). Sound is on by
  default; this is the channel that has to reach you across the room.
- **Copy** — title = `<session title>`, body = `<project> · needs you` or `<project> · failed`.
  No `Argo` in the title (macOS renders the app name itself). The project is mandatory: this is
  the one cross-project channel, and the session title alone does not say where. State words come
  **verbatim from the status vocabulary registry**, so banner, dot, and roll-up read identically;
  `stopped` and `ended` both render `failed`, the same fold as the dot. The agent's raw request is
  **not** in the body — an OS surface we do not control the truncation of invites deciding from
  the banner, when the real output lives one gesture away in the Dock (failure spec §5).

**Nothing else notifies.**

- **Connection failures do not** — `needs reconnect`, account-level OAuth expiry, `folder not
  found` (failure spec §2/§3/§6). Connection state is surfaced only for the *active* project with
  background projects silent, so there is no cross-project badge to project; and nothing is
  *waiting* on you — writes stay live while `stale`. An interrupt that cannot be acted on faster
  than "next time I look" trains you to dismiss the channel, which then costs the amber
  notification that mattered. Cost: an overnight token expiry is discovered on return.
- **Delivery does not** — CI checks, review requested, merges. They are provider-polled, so a
  banner asserting *now* would fire off a possibly-minutes-old fact (a false `DIRECT` in banner
  form); GitHub already notifies on all three; and #167 separated Delivery from session liveness
  and Work Item status as its own axis — letting CI into this channel quietly re-merges them.
- **A menu-bar / tray item is out of scope** for the Phase-1 map — a fourth rendering of the same
  signal, with its own always-on menu surface, that only earns its place once the dock proves
  insufficient in use.

## Follow-up

- **Reconcile `cockpit-session-interior-prototype.html`** — its room tabs currently read
  `⌘1 Work · ⌘2 Sessions`; correct to the canonical `Sessions ⌘1 · Work ⌘2`. A trivial
  prototype edit, folded in whenever that file is next touched (not its own ticket).
