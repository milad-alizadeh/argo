## Storage & ownership

Every source of truth is external: Tickets live in a project-management provider, Delivery
truth in a code host, Sessions in the filesystem (CLI transcripts) + terminal. Argo owns only
the **glue** — the Project registry, the Account registry, and the user-asserted links no
external signal carries.

- **Argo-owned per-machine state** lives in one SQLite database under `userData`. Durable tables
  are authoritative for registries, global settings, user-asserted links, and resumable setup
  checkpoints. Credentials stay in the OS keychain.
- **ProjectSetup** — the one Project-owned, resumable process that determines `ready | deferred`.
  Its method is `manual | agent`: manual stores Project details without executing them, while
  agent plans and applies changes before the Project opens. Repair or upgrade starts a new Attempt
  in the same ProjectSetup.
- **ProjectSetup Attempt** — one numbered planning-and-application cycle within a ProjectSetup. It
  retains the reviewed source plan, the accepted plan, the Harness, and the Sessions that produced
  its result.
- **The join is derived, never stored.** Branch-per-session, work-item-per-branch, PR/CI state
  are all derivable. The **Hub** assembles the join in memory on launch as a throwaway
  projection (ADR-0008).
- **Derived indexes share the database but not its authority.** Their tables are disposable and
  rebuild from external sources. Rebuilding them never replaces or deletes durable tables.
