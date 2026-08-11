## Observation surface (cross-cutting)

- **Terminal** — a PTY Argo owns, running in a Workspace's cwd. As an *observation* surface it
  is the **session terminal**: the live, steerable view of a managed Session (managed-only).
- **Transcript** — the **read-only replay** view, parsed from the CLI's on-disk record. Any
  session, external or historical.
