## Storage & ownership

Vendor facts remain external: Tickets live in a project-management provider, Delivery truth in a
code host, and Session history behind vendor interfaces. Argo owns the **glue** — the Project and
Account registries, each Project's Workspace registry, local Session IDs and pins, and the
  user-authored drafts, and user-asserted links no external signal carries.

- **Argo-owned per-machine state** lives in one SQLite database under `userData`. Durable tables
  are authoritative for registries, local Session IDs and pins, user-authored drafts, and
  user-asserted links. Credentials stay in the OS keychain.
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
