# SQLite owns per-machine state and derived indexes

Status: accepted (#2381) · 2026-09-17

Argo keeps one SQLite database under `userData`. Durable tables are the source of truth for
Argo-owned per-machine state, including registries, global settings, and user-asserted links.
Credentials remain in the OS keychain. Disposable tables hold indexes and caches rebuilt from
external sources. A rebuild can replace disposable tables only, so index recovery cannot erase
durable state. This amends the files-only storage substrate in ADR-0008 and ADR-0017 without
reviving their rejected persisted join: Sessions, Tickets, and Delivery facts remain owned by
their external sources, and the Hub still derives their relationships.

The Session index made SQLite an always-present dependency. Keeping authoritative JSON files
beside it would create two storage systems with separate migrations, write queues, and failure
rules. The shared database gives Argo-owned state and indexes one transactional substrate while
their table contracts preserve the authority boundary.

Argo is still in development, so this change starts with a new database and does not migrate the
existing `portable-v1` files. Durable tables use automatic SQLite backups. If a durable table
cannot be read safely, Argo opens a recovery surface instead of deleting the database. Index
recovery remains table-scoped and automatic.

## Amendment · backup and recovery (#2400) · 2026-09-20

Argo writes an SQLite backup after each durable write. The backup contains only the shared
database, so it does not copy credentials or Session archives. If Argo cannot open the durable
database, it offers to restore the latest backup or quit. It does not replace the damaged file
without that choice. The Session index stays disposable. Its own recovery discards only its
cache tables and rebuilds them from CLI transcripts.
