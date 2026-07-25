# Designs

Committed design studies for the Argo cockpit. These are high-fidelity static HTML designs —
open any file in a browser.

> **Wayfinder [#157](https://github.com/milad-alizadeh/argo/issues/157) is the source of truth
> for the redesigned cockpit.** The old design set (`cockpit.html`, `cockpit-matrix.md`,
> `cockpit-inventory.md`, `foundations.html`) was **wiped** — it described the app being
> replaced. The cockpit is re-derived first-principles on the new domain model; foundations
> and a fresh UI inventory are rebuilt downstream (Phase 2/3). The set below is the surviving
> direction.

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

Prototypes are **standalone** — each opens on its own; #178 stitches them into one switcher as
the final step of the map. The domain model is **not** here: it lives in `CONTEXT.md` at the repo
root, with ADRs 0013–0018 under `docs/adr/`.

| File | Screen | Notes |
|---|---|---|
| `cockpit-penumbra-reference.html` | The locked look-and-feel reference (wayfinder #158) | Penumbra: warm graphite `#0A0B0D` + Eclipse gold `#C8A968`, orb-as-key-light, cove lighting, dust, card planes. Colour/mood/effects only — layout & density deferred |
| `cockpit-session-interior-prototype.html` | Session interior (wayfinder #161 / #186) | The settled session card: master–detail Activity and Delivery, folded turn spine, expandable Dock. Absorbs the delivery-review and fresh-session studies |
| `cockpit-session-interior-decisions.md` | Session-interior decision log | The grill behind the prototype above — roster rows, dot-carries-state, zero-state, panel natures |
| `cockpit-work-room-prototype.html` | Work room interior (wayfinder #185, from #160) | List rail (Next-up hero over a hierarchy) + two-pane ticket detail. Generic node tree — any node opens in detail identically |
| `cockpit-code-room-prototype.html` | Code room (wayfinder #183) — **and the chrome reference** | The light-IDE surfaces: file explorer, editor, scratch terminal, git chrome. Third top-level room, `Code ⌘3`. #201 made its merged floating top bar the shell's chrome in **every** room; the other prototypes are reconciled to it |
| `cockpit-delivery-review-prototype.html` | Delivery review study | Superseded as a standalone surface — absorbed into the session interior above; kept for its review-pane lineage |
| `cockpit-fresh-session-prototype.html` | Spawn UX / fresh session (wayfinder #186) | The pre-first-turn session state |
| `cockpit-session-moodboard.html` | Look exploration | Pre-#158 mood exploration; superseded by the Penumbra reference |
| `cockpit-app-shell-spec.md` | App shell (wayfinder #172, amended by #201) | Written spec, not a pixel study: canonical chrome (merged top bar, borderless strip, global git control, connection-chip placement), room tabs, the ⌘K/keyboard model, and the shell's connective tissue |
| `cockpit-code-room-spec.md` | Code room spec (wayfinder #183) | The written spec derived from the Code-room prototype |
| `cockpit-failure-states-spec.md` | Failure states (wayfinder #173) | Cross-cutting policy for when a fact goes bad mid-flight: staleness as its own axis, the connection chip, pessimistic writes, real-output-not-paraphrase |
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
