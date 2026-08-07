# #377 Native Sessions roster

1. Extend the shell Session presentation with model, workspace, access, and honest state facts.
2. Project those facts into stable roster rows without changing input order or selection identity.
3. Disambiguate duplicate workspace names with the shortest useful parent-qualified identity.
4. Keep full filesystem locations out of default text but available to help and copy actions.
5. Build one flat native-sidebar `SessionRow` with tokenized typography, status, and selection.
6. Use a compact lock only for read-only Sessions and no repeated read-only wording.
7. Preserve native `List` selection while adding the contract's thin Ion Blue indicator.
8. Add previews for operational states, long/duplicate names, external, empty, and no selection.
9. Add table-driven projection tests before implementation and observe their initial failure.
10. Run focused Swift tests, lint/quality checks, a strict app build, and real-window verification.

```yaml
criteria:
  - id: ROSTER-1
    check: "Roster projection preserves input order and produces honest, path-free row labels for operational, duplicate-workspace, and read-only states."
    evidence: "test:apps/macOS/Packages/ArgoUI/Tests/ArgoUITests/SessionRosterProjectionTests.swift"
  - id: ROSTER-2
    check: "The native macOS app builds with the production Session rows wired to Hub projections."
    evidence: "cmd:bun run build --filter=@argo/macos"
  - id: ROSTER-3
    check: "The Swift package tests and repository quality gates remain green."
    evidence: "cmd:bun run test --filter=@argo/macos && bun run quality"
```
