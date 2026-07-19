# Designs

Committed design studies for the Argo cockpit. These are high-fidelity static HTML designs —
open any file in a browser. They are the **agreed-latest** set; superseded drafts
(v0–v6, palette explorations, fleet variants) were pruned rather than kept.

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
| `foundations.html` | The living token specimen — type roles, core ramps, semantic bindings (both themes) | **Non-disposable** — renders `tokens.css` directly, so it always shows the current contract |
| `cockpit.html` | Single-session cockpit — **the final design** (v8 "ship ribbon") | Story\|Work panes · PR-lifecycle ribbon (Commits→PR→CI→Review→Merge) · Background Tasks roster (R15) · console channels. Settled 2026-07 from the five-lens UX audit; supersedes v7 |
| `cockpit-matrix.md` | The cockpit's testable spec | Session facts → rules R1–R15 → state table S0–S11 → pane anatomy/routing. Becomes the component unit tests at componentize time |
| `cockpit-inventory.md` | Component inventory for `cockpit.html` | name · tier · props/variants · composed-of — the build contract `/componentize-design` consumes. Ticketed as GitHub issues #18–#30 (native `blocked_by` edges follow composed-of) |

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
