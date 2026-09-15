# Feed polish

1. Trace the virtual feed, expandable content, and latest-position control.
2. Add regression coverage for the initial collapsed state and reader position.
3. Animate only measured, mounted content and honor reduced motion.
4. Keep the virtualizer as the only feed owner.
5. Verify the story and the debug Electron reader with variable-height output.

```yaml
criteria:
  - id: FEED-1
    check: "Collapsed text and tool groups do not flash open on first render."
    evidence: "test:apps/desktop/src/renderer/modules/sessions/feed"
  - id: FEED-2
    check: "Open and close motion honors reduced motion and keeps the reader position stable."
    evidence: "test:apps/desktop/src/renderer/modules/sessions/feed"
  - id: FEED-3
    check: "The down-arrow Jump to Latest control is visible away from the feed end."
    evidence: "test:apps/desktop/src/renderer/modules/sessions/feed"
  - id: FEED-4
    check: "The desktop quality gate passes."
    evidence: "cmd:bun run quality"
```
