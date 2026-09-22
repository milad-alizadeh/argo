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

## Amendment · Drizzle owns schema changes · 2026-09-21

Drizzle Kit generates the shared schema history and normal indexes. Domain table definitions stay
beside the domains that own them, and one Drizzle configuration collects them. Custom SQL
migrations own FTS5 tables, triggers, and data changes that Drizzle cannot express.

The pinned Drizzle release candidate now owns normal durable reads, writes, and transactions
through `drizzle-orm/node-sqlite`. Repositories import the shared Drizzle adapter, never
`node:sqlite`. Raw SQLite stays limited to FTS5, required PRAGMAs, and operations Drizzle cannot
express. Repository contract tests cover the pinned adapter before an upgrade.

ADR-0047 replaces transcript-built Session indexes. Vendor interfaces are the only input to the
disposable Session metadata and FTS5 tables. The development cutover resets the existing database
and removes old JSON stores, compatibility readers, and legacy migrations. Backup and recovery
apply from the first shipped version of the new schema.
