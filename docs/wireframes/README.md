# Wireframes

Committed design studies for the Argo cockpit. These are static HTML prototypes —
open any file in a browser. They are the **agreed-latest** set; superseded drafts
(v0–v6, palette explorations, fleet variants) were pruned rather than kept.

The graph ignores `docs/` (see `.graphifyignore`), so these HTML files never enter
the code knowledge graph.

## Current set

| File | Screen | Notes |
|---|---|---|
| `cockpit-v7-phosphor.html` | Single-session cockpit — session/work view | v7, phosphor treatment |
| `cockpit-v7-narrative.html` | Single-session cockpit — narrative view | v7, narrative treatment |
| `cockpit-finding-clicked.html` | Cockpit — review finding opened | v7 state |
| `cockpit-findings-off.html` | Cockpit — findings resolved/off | v7 state |
| `workflow-fanout-v2.html` | Workflow fan-out | v2 |
| `orchestrator-v2.html` | Orchestrator | v2 |
| `codex-v2.html` | Codex turn timeline | v2 |

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
