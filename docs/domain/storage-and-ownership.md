## Storage & ownership

Vendor facts remain external: Tickets live in a project-management provider, Delivery truth in a
code host, and Session history behind vendor interfaces. Argo owns the **glue** — the Project and
Account registries, each Project's Workspace registry, local Session IDs and pins, and the
user-asserted links no external signal carries.

- **Argo-owned per-machine state** lives in one SQLite database under `userData`. Durable tables
  are authoritative for registries, local Session IDs and pins, global settings, user-asserted
  links, and resumable setup checkpoints. Credentials stay in the OS keychain.
- **ProjectSetup** — the one Project-owned, resumable process that determines `ready | deferred`.
  It starts after Project registration. Its method is `manual | agent`: manual validates and stores
  Project details without a setup worktree or execution, while agent plans and applies changes
  before the Project opens. Repair, upgrade, or deferred setup can reactivate the same ProjectSetup
  after `ready | deferred`. Errors, cancellation, and interruption remain recoverable states.
- **ProjectSetup Attempt** — one numbered planning-and-application cycle within a ProjectSetup. It
  retains the reviewed source plan, the accepted plan, the selected Harness, and the Session that
  produced its result. Planner feedback creates an immutable plan revision in the
  same Attempt. An accepted plan contains only reviewed items and bounded choices. Resume
  reconciles the setup worktree and continues the same Attempt and Session. The Session changes
  from read-only planning to sandboxed application after plan acceptance. A new repair Attempt is
  created only when that Session cannot resume or the user starts a later repair. Attempt numbers
  are never reused.
- **The join is derived, never stored.** Branch-per-session, work-item-per-branch, PR/CI state
  are all derivable. The **Hub** assembles the join in memory on launch as a throwaway
  projection (ADR-0008).
- **Session storage** — one table holds each Argo UUID, its unique Harness and native ID pair,
  vendor metadata, Project link, custom title, and local fields. The vendor is authoritative for
  its metadata and custom title. One domain upsert assigns a UUID on first insert and serves both
  live creation and sync. A failed or incomplete scan does not delete known Sessions.
- **Derived indexes share the database but not its authority.** Session history search and Ticket
  query tables can rebuild through vendor interfaces. Rebuilding them never replaces Session
  identity or other durable Argo state.
