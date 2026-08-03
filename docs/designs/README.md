# Designs

The committed design set for the Argo cockpit: written specs (`.md`) and high-fidelity static
HTML studies — open any HTML file in a browser.

> **Wayfinder [#157](https://github.com/milad-alizadeh/argo/issues/157) is the source of truth
> for the redesigned cockpit.** The old design set (`cockpit.html`, `cockpit-matrix.md`,
> `cockpit-inventory.md`, `foundations.html`) was **wiped** — it described the app being
> replaced. The cockpit is re-derived first-principles on the new domain model. Phase 2
> (#262) is **landed**: `foundations.html` below is the rebuilt token contract on Penumbra.
> Phase 3 (#263) is **landed**: `cockpit-ui-inventory.md` is the build contract the room
> tickets compose from.

## The contract — [`foundations.html`](foundations.html)

The living specimen of `apps/desktop/src/renderer/src/styles/argo-tokens.css`: every type
role, core ramp, semantic role, status family, spacing step, radius rung, plane depth and
motion token, rendered on the real Penumbra scene with a light/dark toggle. It styles only
via `var(--token)` and reads its own labels back off the computed values, so it **cannot
drift** — if the contract changes, this page changes with it. It is the one study that is
not disposable.

Settled by #262: Eclipse gold is the single accent **and** `needs you` (so selection is an
ink wash, never gold), `done` is quiet slate rather than green, the density is one 9/11/13/15
sans ladder, and Inter ships with the app. A study that needs a value the contract lacks
marks it a **proposal**; promoting one is a contract change that comes back through the
bless step of `/design-foundations`.

## Start here — the assembled spec

**[`cockpit-spec.md`](cockpit-spec.md) is the front door.** It states what the cockpit is in one
document — shell, the three rooms, onboarding, status vocabulary, degradation, failure policy,
out-of-window attention, and the architecture the domain model forces — and cites the per-surface
docs below for the detail rather than restating them. It is the **join** of wayfinder #157's
Phase 1 (#253 / #254), not a replacement for its artifacts.

## Then read the build contract

**[`cockpit-ui-inventory.md`](cockpit-ui-inventory.md) is Phase 3 (#263):** every component the
shell and the three rooms need, with its states and its module slice. Names are the
`data-component` names the prototypes already decided, states trace to the surface matrix and the
status registry, and values come from the token contract rather than prototype inline styling. It
also states which prototype names must **not** become components, and which domain objects are
still unhomed. A room ticket composes from it instead of inventing an inventory.

Two reasons to read the assembled spec before anything in the table: the amendments that live only in closed issue
comments (#201, #202, #178's audit) are applied **inline**, so the assembled read is the current
read; and it states the **delta** between the running `apps/desktop` and the specified cockpit,
which no per-surface doc owns.

## Authoring a new study

Copy `study-template.html` and follow its inline conventions (rules/design-studies.md):

- `tokens.css` — the study vocabulary. It `@import`s the app's real contract
  (`apps/desktop/src/renderer/src/styles/argo-tokens.css`) so studies can't drift,
  and adds the typography role classes (`.text-headline` … `.text-code-inline`, `.mono`).
- `kit.js` — shared named render functions for recurring atoms/molecules; call
  them, never re-write their markup.
- `data-component="PascalCaseName"` on every meaningful region — the future
  component's name, decided in the study.

The graph ignores `docs/` (see `.graphifyignore`), so these HTML files never enter
the code knowledge graph.

## Current set

Prototypes are **standalone** — each opens on its own. `cockpit-prototype-switcher.html` (#178)
stitches them into one review harness without merging them; open it to walk every surface and
state in a sitting. **Onboarding is the exception**: it has a spec and no prototype (#205), and
appears in the harness as a visible dead slot.
The domain model is **not** here: it lives in `CONTEXT.md` at the repo root, with ADRs 0013–0018
under `docs/adr/`.

| File | Screen | Notes |
|---|---|---|
| `foundations.html` | **The token contract, rendered** (wayfinder #157 Phase 2, via #262) | Above. Not disposable, and not drift-able — it reads the contract it documents |
| `cockpit-ui-inventory.md` | **The build contract** (wayfinder #157 Phase 3, via #263) | Above. Every component of the shell and the three rooms with its states and its slice, re-derived first-principles: the wiped `cockpit-inventory.md` contributed nothing |
| `cockpit-spec.md` | **The assembled contract** (wayfinder #157 Phase 1, via #253/#254) | The front door above. Every row below is its detail of record; it cites them and restates none of them |
| `cockpit-prototype-switcher.html` | The review harness — **start here for pixels** (wayfinder #178) | Left rail walking all 22 states across the three rooms + the look anchor; iframes each file untouched. `?surface=&state=` deep-links. Throwaway: expires with the prototypes it wraps. Manifest is an inline array in the file — `file://` blocks `fetch`, so it cannot be external |
| `cockpit-penumbra-reference.html` | The locked look-and-feel reference (wayfinder #158) | Penumbra: warm graphite `#0A0B0D` + Eclipse gold `#C8A968`, orb-as-key-light, cove lighting, dust, card planes. Its values are now **in the contract** (#262) — read `foundations.html` for the settled form; this file stays as the look's provenance |
| `cockpit-session-interior-prototype.html` | Session interior (wayfinder #161 / #186) | The settled session card: master–detail Activity and Delivery, folded turn spine, expandable Dock. Absorbs the delivery-review and fresh-session studies |
| `cockpit-session-interior-decisions.md` | Session-interior decision log | The grill behind the prototype above — roster rows, dot-carries-state, zero-state, panel natures |
| `cockpit-work-room-prototype.html` | Work room interior (wayfinder #185, from #160) | List rail (Next-up hero over a hierarchy) + two-pane ticket detail. Generic node tree — any node opens in detail identically |
| `cockpit-code-room-prototype.html` | Code room (wayfinder #183) — **and the chrome reference** | The light-IDE surfaces: file explorer, editor, scratch terminal, git chrome. Third top-level room, `Code ⌘3`. #201 made its merged floating top bar the shell's chrome in **every** room; the other prototypes are reconciled to it |
| `cockpit-delivery-review-prototype.html` | Delivery review study | Superseded as a standalone surface — absorbed into the session interior above; kept for its review-pane lineage |
| `cockpit-fresh-session-prototype.html` | Spawn UX / fresh session (wayfinder #186) | The pre-first-turn session state |
| `cockpit-session-moodboard.html` | Look exploration | Pre-#158 mood exploration; superseded by the Penumbra reference |
| `cockpit-app-shell-spec.md` | App shell (wayfinder #172, amended by #201 and #202) | Written spec, not a pixel study: canonical chrome (merged top bar, borderless strip, global git control, connection-chip placement), room tabs, the ⌘K/keyboard model, the shell's connective tissue, and Project Settings (= #165's connect panel re-entered) |
| `cockpit-code-room-spec.md` | Code room spec (wayfinder #183) | The written spec derived from the Code-room prototype |
| `cockpit-failure-states-spec.md` | Failure states (wayfinder #173) | Cross-cutting policy for when a fact goes bad mid-flight: staleness as its own axis, the connection chip, pessimistic writes, real-output-not-paraphrase |
| `cockpit-onboarding-spec.md` | Onboarding (wayfinder #165) | Written spec, **no prototype** — the #165 study was never committed and was not reconstructed (#205). Two screens, three independent connect rows, folder-not-repo floor, device-flow sign-in, seven states |
| `cockpit-status-vocabulary.md` | The canonical status-word registry (wayfinder #174, amended by #173) | One word per state, identical everywhere. Argo-owned words (session · attention · delivery · check · connection) vs provider-owned Work Item status shown verbatim |
| `cockpit-surface-matrix.md` | The surface × state matrix | Enumerates every cockpit surface and the states it must render — the testable spec the prototypes are checked against |

## Lineage & decisions

The v0→v7 progression and the 5-reviewer simplification pass that produced this
direction (v1-lean base + v2 inline-walk review + v3 voice posture) are recorded in
the design session; the settled cockpit UI model lives in the ADRs under `docs/adr/`.

## Regenerate a screenshot

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=2 --window-size=1680,1050 \
  --screenshot=out.png "file://$(pwd)/<file>.html"
```

Storybook side (component parity): with Storybook running in `apps/desktop`, use the
same command against `http://localhost:6006/iframe.html?id=<story-id>&viewMode=story`.
The parity check is a side-by-side eyeball of the two screenshots per the
componentize ceremony — no automated compare, no committed baselines.
