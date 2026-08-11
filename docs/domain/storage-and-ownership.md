## Storage & ownership

Every source of truth is external: Work Items live in a project-management provider, Delivery
truth in a code host, Sessions in the filesystem (CLI transcripts) + terminal. Argo owns only
the **glue** — the Project registry, the Account registry, and the user-asserted links no
external signal carries.

- **Files are always the source of truth.** Argo's owned state lives in **per-machine app
  data** (`userData`), **never committed** (sessions, paths, registration are per-machine).
- **The join is derived, never stored.** Branch-per-session, work-item-per-branch, PR/CI state
  are all derivable. The **Hub** assembles the join in memory on launch as a throwaway
  projection (ADR-0008).
- **SQLite, if it returns, is only ever a rebuildable cache/index** — never a source of truth.
  Deferred until profiling forces it.
