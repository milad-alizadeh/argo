# Geist desktop typography contract

1. Inventory the text roles used by each app-owned desktop surface.
2. Keep shared shadcn primitive defaults behind the Tailwind token boundary.
3. Map ordinary cockpit text to one dominant 13px interface rung.
4. Reserve 11px for metadata and 12px Geist Mono for technical text.
5. Load Geist Sans and Geist Mono from bundled variable-font packages.
6. Remove Session-only and roster-only aliases that bypass the shared scale.
7. Keep feed body text and command summaries on the dominant rung.
8. Replace conflicting size utilities in app-owned product components.
9. Document the ownership model and regenerate the token mirror.
10. Prove the contract with focused tests, gates, and light/dark renders.

```yaml
criteria:
  - id: TYPO-1
    check: "The desktop bundles Geist Sans and Geist Mono and maps each product text surface to the shared role contract."
    evidence: "test:apps/desktop/src/renderer/styles/typography-contract.test.ts"
  - id: TYPO-2
    check: "App-owned text uses one dominant interface rung, with metadata and machine text as the only routine compact tiers."
    evidence: "test:apps/desktop/src/renderer/styles/typography-contract.test.ts"
  - id: TYPO-3
    check: "Sessions renders show matching feed body and command-summary typography in light and dark appearances."
    evidence: "visual:storybook/sessions-feed--all-row-variations,sessions-roster--command-titled-session"
  - id: TYPO-4
    check: "Desktop typecheck, lint, and design-token checks pass."
    evidence: "cmd:bun run format-and-lint && bun run quality:types && bun run quality:design-tokens"
```
