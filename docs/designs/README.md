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

| File | Screen | Notes |
|---|---|---|
| `cockpit-penumbra-reference.html` | The locked look-and-feel reference (wayfinder #158) | Penumbra: warm graphite `#0A0B0D` + Eclipse gold `#C8A968`, orb-as-key-light, cove lighting, dust, card planes. Colour/mood/effects only — layout & density deferred |
| `cockpit-sessions-room-prototype.html` | Sessions room in Penumbra (wayfinder #159) | Proves the foundation holds on a real screen: project strip · roster · session card + Outcomes · Concierge as a fixed global bottom strip (cheap ring-orb + caption + conversation toggle). Prototype fidelity — not a settled build contract. Panel structure is a sketch, being re-derived under #157 |
| `cockpit-domain-model.md` | The cockpit's domain model | Three-entity model (Actor · Agent · Run) and the two-port adapter architecture the surfaces are derived from; see ADRs 0013–0016 under `docs/adr/` |
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
