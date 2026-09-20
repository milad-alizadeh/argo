## Storage & ownership

Every source of truth is external: Tickets live in a project-management provider, Delivery
truth in a code host, Sessions in the filesystem (CLI transcripts) + terminal. Argo owns only
the **glue** — the Project registry, the Account registry, and the user-asserted links no
external signal carries.

- **Argo-owned per-machine state** lives in one SQLite database under `userData`. Durable tables
  are authoritative for registries, global settings, user-asserted links, and resumable setup
  checkpoints. Credentials stay in the OS keychain.
- **The join is derived, never stored.** Branch-per-session, work-item-per-branch, PR/CI state
  are all derivable. The **Hub** assembles the join in memory on launch as a throwaway
  projection (ADR-0008).
- **Derived indexes share the database but not its authority.** Their tables are disposable and
  rebuild from external sources. Rebuilding them never replaces or deletes durable tables.
