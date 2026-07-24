# Failure states spec

> Wayfinder #173, part of #157. **What the cockpit does when a fact goes bad mid-flight.**
> Cross-cutting policy, one canonical home — the same call #174 made for status words, for the
> same reason: nine rules touching every surface, no natural per-surface owner. Surface specs
> **cross-reference** this doc, never restate it.
>
> #173 was originally chartered as a cross-surface *prototype* of edge/empty/error states.
> Re-triaged to `grilling` after audit: **empty states and tier-degradation were already
> absorbed** by the per-surface tickets (see [What this doc does not own](#what-this-doc-does-not-own)),
> leaving **failure** — the one class no surface ticket covered — as the residue. It produces
> rules, not pixels; the single pixel question (the connection chip) hands to #201.

## Scope

**Owns:** mid-flight failure. A fact that was established and went bad, or an operation that was
attempted and did not succeed. Provider reads failing, tokens expiring, writes rejected,
mechanical git ops erroring, the project folder vanishing, Argo's own observation going blind.

**References, does not re-spec:** the reconnect flow → #165 · provider write intents and the
canonical five → #167 · the session dot's four states → #164 · status words → the status
vocabulary registry · the brow's chrome and the chip's rendering → #201 · OS-level notification
of any of this → #188 · Concierge narration of failure → #190.

---

## 1 · Staleness is its own axis

The honesty tiers (`DIRECT` / `DERIVED` / `CONVENTION`, ADR-0016) answer **how do we know this**.
They do not answer **when did we last hear it**. Those come apart the moment a provider poll
fails: yesterday's ticket list is still accurately `DERIVED` — it is simply old.

- **Staleness is a fourth, orthogonal axis**, and it is a property of the **connection**, never
  of an individual fact. There are no per-fact staleness badges.
- **Successfully-fetched data stays rendered at full fidelity** when reads start failing. It is
  not a false `DIRECT`: it is an accurate record of what the provider last said.
- The surface matrix's **"surfaces hide whole — no half-filled skeletons"** governs the **tier**
  axis only (no companion plugin ⇒ the Outcomes section is *absent*). It does **not** govern
  freshness. This narrows the status vocabulary registry's closing "Empty / degraded" note, which
  reads as though it covered both.

**Why not blank on failure:** blanking is more literally honest and cheaper to spec, but it means
a dropped packet erases your backlog, and it withholds exactly the context you need when
something has just broken. The data is old, not wrong; say so and keep it.

## 2 · Connection state belongs to a binding, not a project

A Project carries **three independent bindings** (`CONTEXT.md` → Ports, ADR-0014): a **folder /
git root** (always present, local, and the project's scope per ADR-0015), an **optional Work Item
provider** (GitHub Issues or Linear), and an **optional Code host** (GitHub). They fail
independently and at different levels:

| Level | What breaks | Blast radius |
| --- | --- | --- |
| **Account** (global) | the OAuth grant expires or is revoked — one grant feeds both GitHub ports, keychain-stored (ADR-0018) | **every** GitHub-bound project at once |
| **Binding** (per project × per port) | repo renamed, org access revoked, Linear workspace unreachable, rate-limited | one port of one project — a Linear + GitHub project can have Work Items stale while Delivery is live |
| **Local** (per project) | folder moved or deleted, no longer a git root | one project — and not a connection failure at all (§6) |

- Connection state is **per-project truth, surfaced only for the active project.**
- **Background projects stay silent.** A background project whose provider died does **not** light
  its strip dot. You learn on switch — which is also the first moment you could act on it.
- **The project-strip dot stays session-only**, exactly as #164 locked it: worst-state, amber
  `needs you` > red `failed` > green `running` > none. Connection health never enters that channel.

**Why:** the strip dot's one channel carries *"your agent is waiting on you"* — something you can
act on this second. Putting *"GitHub is unreachable"* at the same urgency, in the app's densest
60px, trains you to distrust it. The accepted cost is that you can be signed out of a background
project for an hour without knowing; nothing is lost by the delay. A distinct second mark
(hollow ring, struck icon) was considered and cut — it buys a warning-at-a-distance for a second
visual vocabulary in the strip.

## 3 · One connection chip, rolling up the bindings

Lives in the **top brow's right cluster**, beside the branch chip (#183). Its placement and
rendering are an input to **#201**, which owns that chrome; this doc owns only its behaviour.

**Two visible states. Silent when healthy.**

| State | Renders | Action |
| --- | --- | --- |
| *(healthy)* | **nothing** | — |
| `stale` | one quiet chip carrying age + cause word: `GitHub · 4m ago · offline`. Both bindings down ⇒ `2 connections stale` | none — you wait |
| `needs reconnect` | the chip becomes a button | hands off to #165's **in-panel** reconnect |

- **Rolls up over the active project's bindings**, expanding on click to name which one is down.
  The roll-up is honest because **your action is identical either way**. Per-port truth exists;
  it just is not glanceable chrome.
- **`offline`, `unreachable`, and `rate limited` are cause *words inside the chip*, not states.**
  Your action in all three is the same, so they would render no differently as separate states.
- **Account-level auth is the one escalation past the roll-up** — it is the only failure with an
  action and the only one whose blast radius is every project.
- **`connected` renders nothing.** No green light: Penumbra's one-bright-thing law, and a
  permanently-lit healthy indicator trains you to ignore the spot the warning will appear in.
  The accepted cost is that absence is ambiguous; answer it with `last synced` on **hover of the
  project name**, not with a persistent chip.

## 4 · No optimistic writes

Every one of #167's eight canonical write intents (`createWorkItem`, `updateFields`,
`transitionTo`, `addBlockedBy` / `removeBlockedBy`, `setParent`, labels, `setPriority`,
`close` / `reopen`) is remote HTTP, and the cockpit is **polled — a desktop app receives no
webhooks** (`CONTEXT.md` → Ports). So a round trip sits between the click and the truth.

**Writes render pessimistically, with an in-place pending state.**

- **Pending** — the control disabled in place, no layout shift. Not a toast, not a global spinner.
- **Failure** — the control returns to its prior state, error **inline at the control**, carrying
  the real reason (§5). Toasts are missable and dismissable, and the one thing you need to know
  belongs on the thing you just pressed.
- **No auto-retry on user-initiated writes.** You pressed it, you saw it fail, you press again —
  auto-retrying a `transitionTo` risks double-applying against a provider whose transition
  legality is per-workflow.
- **Success adopts the response body** as the new truth — the provider's own word, fresh — rather
  than waiting for the next poll to catch up.

**Why this is forced, not preferred:** an optimistic paint **is a false `DIRECT`**. `CONTEXT.md`'s
degrade-down rule (ADR-0008, generalized) says a fact that cannot be established honestly is
shown as unknown, never defaulted; #167 further ruled Work Item status **purely provider-sourced,
never synthesized from local facts**. Painting `done` before the provider has said `done`
synthesizes a provider fact from a local one (your click). The usual counter — optimism hides
latency — does not apply: **the write's own HTTP response is the confirmation**, so the wait is
one round trip, not a poll interval.

## 5 · Real output, never a paraphrase

#161 put the *mechanical, deterministic* git ops in the cockpit's hands (discard, unstage/exclude,
revert-file, commit, push, create-PR, merge — never routed through the LLM); #183 added fetch /
pull-ff / push and branch CRUD with **no merge-conflict GUI**. So the cockpit holds git's stderr
routinely.

**One-line summary at the control; the real, unabridged output one gesture away in the nearest
raw channel.** A paraphrase is never the only artifact.

| Context | Raw channel |
| --- | --- |
| In a session | the always-on expandable **Dock** (#161). Summary at the control, `↳ see output` opens the Dock scrolled to it |
| In the Code room | the **scratch terminal** — already #183's designated escape hatch for anything the git chrome will not model |
| Neither (e.g. spawn from an empty roster) | inline at the invoking affordance, error text verbatim |

This is the routing law from the surface matrix (**raw I/O → Console channel**) applied to
failure, not a new home.

**Why a hard rule:** git's stderr *is the fix*.
`! [rejected] ... hint: Updates were rejected because the remote contains work that you do not
have locally` tells you to pull. Compressing that to "Push failed" destroys the only actionable
content and sends you to a terminal to re-run a command whose output Argo already had.
Paraphrase-only failure messages are the most reliable way a git GUI becomes worse than the CLI.
The accepted cost — raw stderr is ugly, occasionally enormous, and leaks git's vocabulary into a
surface that otherwise speaks Argo's — is confined to a channel you opened deliberately.

## 6 · A missing folder disables the project

The folder **is** the project: ADR-0015 makes it the scope, #165 makes it the floor (folder alone
suffices to create a project; git and a provider only *unlock* backlog, PRs, and CI).

- Folder missing at the recorded path ⇒ **the project is disabled, with one simple error state.**
  No partially-lit window, no per-room split.
- Repair is **Relocate** or **Remove project**. Relocate is first-class by design, not a
  workaround: `CONTEXT.md` L1 defines a Project as *"a registered git repo, keyed to a stable id
  (path is a mutable attribute)"* — the id survives, you re-point the path.
- **Running sessions in that folder are not rescued by Relocate** — their PTYs are already broken.
  They degrade to `failed` on the existing four-state dot (#164). No new vocabulary.

A per-room degradation was proposed (Work room alive on remote data, Sessions and Code showing the
folder-missing state) and **rejected**: a project you cannot act in does not earn a half-lit
window, and one error state is cheaper to spec and to build than a per-room matrix.

## 7 · Writes stay live while stale

§4 settles what happens *when* a write fails. This is whether it may be attempted.

- **`stale` ⇒ write controls stay enabled.** A failing read does not prove a write will fail:
  rate limits are per-endpoint, and `stale` can mean nothing worse than a slow poll. Greying a
  control out on a *guess* is the same error as a false `DIRECT` pointed the other way —
  asserting a fact (*this will fail*) that Argo does not have. Let it be attempted; §4's inline
  error then tells the truth with the real reason.
- **`needs reconnect` ⇒ write controls disable**, pointing at the same `Reconnect`. Here Argo
  *does* know: there is no usable token, so the write provably cannot succeed. This is the one
  place the chip's escalation earns its promotion.
- **Staleness never gates local actions.** Spawning a session, the scratch terminal, and git ops
  against the local checkout are folder-sourced and do not care that GitHub is unreachable. Only
  **provider-port writes** are in scope here.

The accepted cost: during a full outage you can hammer a doomed button and collect the same inline
error repeatedly. That beats guessing wrong, because a wrong disable leaves you blocked with no
recourse.

## 8 · Observation failure is not work failure

`CONTEXT.md` flags two `DERIVED` soft-spots to render honestly rather than hide — **external
liveness** (process-match on `cwd` + mtime is *not a unique key*: two `claude` in one repo can
mis-match, and mtime goes stale during long thinking, so it can read live-as-idle) and the
**`~n%` context estimate** (model-dependent denominator, sometimes unnamed in the transcript).
Add a third: **a transcript that will not parse**.

None of these is a failure *of the work*. They are failures of Argo's observation.

- **Observation failure never turns a dot red.** It renders as `unknown` on the specific fact;
  nothing else changes.
- **Unparseable transcript** ⇒ the session row still exists (there is a file, possibly a live
  process). Its **derived** facts go absent — no plan line, no turn spine, `unknown` context —
  while its **direct** facts (pid liveness, path) render normally. **The dot follows liveness, not
  parse success.**
- **Red is reserved for the work failing**: `FAILED`, `CI FAILED`, `ERRORED`, dead PTY.

This is the locked rule applied, not a new one — *"every tier-gated enum carries an explicit
`unknown`/absent rendering; a fact that can't be established honestly is shown as unknown, never
defaulted."* #161 already does it (external ⇒ empty ctx ring + `unknown`). It is worth stating
explicitly anyway: **a red dot is a summons**, and spending one on Argo's own blindness teaches
you to distrust the loudest signal in the app.

---

## Status words this doc adds

Argo-owned, for the connection block of the status vocabulary registry (which does not yet carry
one — see the landing note below):

| Thing | Words |
| --- | --- |
| Connection | `stale` · `needs reconnect` *(healthy renders no word)* |
| Cause (inside the `stale` chip, not states) | `offline` · `unreachable` · `rate limited` |
| Project integrity | `folder not found` |
| Unestablishable fact | `unknown` *(already registered)* |

## What this doc does not own

The audit that re-cut #173. **Empty states and tier-degradation are per-surface and already
settled** — this doc deliberately does not restate them:

| Surface | Empty / zero state | Tier degradation |
| --- | --- | --- |
| App shell (#172) | empty first-run shell + connect seam | `DIRECT` / `DERIVED` / `CONVENTION` section |
| Onboarding (#165) | welcome · fresh | direct · partial · wired (+ in-panel `error`) |
| Sessions room (#159 / #161) | roster zero-state = bare `+ New session` (B6) | external rows ghosted, hollow dot, no Outcomes, `unknown` ctx ring |
| Work room (#160 / #185) | Next-up empty-pool tiers (#166) | no DAG ⇒ blocked filter no-op, `unblocked` chip suppressed |
| Code room (#183) | empty folder · unsupported binary · no folder | `DIRECT` floor is files-on-disk |
| Delivery (#161) | teammate PR with no session row | bare tracker ⇒ three statuses (#167) |

## Landing note

Two artifacts this doc reconciles against are **not on `main`**: the status vocabulary registry
(`cockpit-status-vocabulary.md`, #174) is stranded on `origin/research/dashvox-voicemode-return-path`,
and #165's onboarding prototype and spec were never committed. Both tickets are closed. Tracked as
its own map ticket; until it lands, §3's chip words and the table above have no registry entry to
join, and the registry's "Empty / degraded" section still needs §1's narrowing applied.
