## Storage & ownership

Every source of truth is external: Tickets live in a project-management provider, Delivery
truth in a code host, Sessions in the filesystem (CLI transcripts) + terminal. Argo owns only
the **glue** — the Project registry, the Account registry, and the user-asserted links no
external signal carries.

- **Argo-owned per-machine state** lives in one SQLite database under `userData`. Durable tables
  are authoritative for registries, global settings, user-asserted links, and resumable setup
  checkpoints. Credentials stay in the OS keychain.
- **ProjectSetup** — the one Project-owned, resumable process that determines `ready | deferred`.
  It starts after Project registration. Its method is `manual | agent`: manual validates and stores
  Project details without a setup worktree or execution, while agent plans and applies changes
  before the Project opens. Repair, upgrade, or deferred setup can reactivate the same ProjectSetup
  after `ready | deferred`. Errors, cancellation, and interruption remain recoverable states.
- **ProjectSetup Attempt** — one numbered planning-and-application cycle within a ProjectSetup. It
  retains the reviewed source plan, the accepted plan, the planning and applying Harnesses, and the
  Sessions that produced its result. Planner feedback creates an immutable plan revision in the
  same Attempt. An accepted plan contains only reviewed items and bounded choices. Resume
  reconciles the setup worktree and continues the same Attempt and Session. Application starts a
  fresh Session and can use a different eligible Harness. Restart or rejection of the final diff
  abandons the Attempt and creates the next number with new Sessions; Attempt numbers are never
  reused.
- **The join is derived, never stored.** Branch-per-session, work-item-per-branch, PR/CI state
  are all derivable. The **Hub** assembles the join in memory on launch as a throwaway
  projection (ADR-0008).
- **Derived indexes share the database but not its authority.** Their tables are disposable and
  rebuild from external sources. Rebuilding them never replaces or deletes durable tables.
