# Session + Hybrid Delivery concept variations

These standalone studies explore a clearer Argo cockpit without changing the existing
`docs/designs/` set. They are intentionally separate concept proposals.

## Product frame

- **Audience:** developers supervising one or more coding agents.
- **Primary job:** understand what is happening now, see what prevents delivery, and inspect
  enough evidence to make the next decision safely.
- **Shared interaction model:** sessions remain the outer context; Activity explains execution;
  Delivery moves from an intent summary to review findings to read-only file evidence.
- **Deliberate scope cut:** code is inspected here, not edited. Every code surface offers an
  explicit handoff to an external editor.

## Variations

| File | Direction | What it tests | Recommendation |
| --- | --- | --- | --- |
| [`concept-a-command-spine.html`](concept-a-command-spine.html) | **Command spine** | A persistent left session rail, a dominant `Now → Next gate` handoff, and balanced Activity/Delivery panes | Best default direction; pursue first |
| [`concept-b-review-ledger.html`](concept-b-review-ledger.html) | **Review ledger** | A delivery-first reading sequence where findings and decision history lead, while live activity becomes supporting context | Test with review-heavy users and large diffs |
| [`concept-c-focus-canvas.html`](concept-c-focus-canvas.html) | **Focus canvas** | One primary canvas that adapts aggressively at narrower desktop widths, with context folded into compact rails | Best responsive fallback; combine with A |

Open [`index.html`](index.html) for the comparison launcher. Each page supports:

- `Active` and `Empty` demo states.
- Keyboard-operable tabs with Left/Right/Home/End navigation.
- Visible focus styles and semantic buttons/landmarks.
- Reduced-motion handling through `prefers-reduced-motion`.
- Desktop reflow at approximately 1180px, 1040px, and 860px rather than scaling a fixed canvas.

## Design recommendations embodied here

1. The brightest and largest information is the current operation or the next delivery gate,
   never ambient decoration.
2. Primary reading text starts at 14px; 12px is reserved for metadata.
3. Review begins with intent and risk, then findings, with raw files as evidence.
4. Empty states explain how a session appears and provide a direct next action.
5. A lightweight code viewer is enough inside the cockpit; editing stays in the developer’s
   chosen editor.
