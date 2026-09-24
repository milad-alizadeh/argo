# SQLite read models for Sessions and Tickets

Status: accepted · 2026-09-24

The Session Roster currently mixes vendor pages with SQLite metadata. The renderer must reconcile
source cursors and Argo-owned fields, so paging and search depend on adapter behavior. Ticket
queries have a similar split. Argo will give the renderer one validated IPC read surface backed by
SQLite for Sessions and Tickets. Live connections and mutations still go through their vendor
adapters. Delivery facts, including pull requests and CI, need a separate design.

## Identity and ownership

Every Session has an Argo UUID and a unique `(Harness, native Session ID)` pair. Argo creates the
row immediately for a Session it starts and assigns the same UUID on later discovery. The pair
remains the vendor identity for history and resume. Forks are separate Sessions. Argo owns local
titles, pins, pinned order, and user-asserted Ticket links. These survive rebuilding the vendor
index. Argo title wins over linked Ticket title, vendor title, and first prompt, in that order.
Linking a Ticket changes the displayed name only when no Argo title is set; it does not copy the
Ticket title or rename the vendor Session.
The effective Ticket link follows ADR-0017: a positive branch-derived Delivery-to-Ticket link wins;
an asserted Delivery-to-Ticket link fills only an unlinked derivation; a branchless Session can
assert its own Ticket link. An asserted link survives provider disconnection and Ticket deletion.

Vendor Session metadata, searchable history text, and Ticket content live in disposable SQLite
query tables. Their providers remain authoritative. The Ticket index covers the active backlog and
Tickets linked to Argo work. Search tells the reader when older Ticket history is not indexed. A
missing Session or Ticket opened by direct reference gets a priority sync and a loading state until
its row is committed. A vendor-confirmed permanently unrecoverable Session is removed with its
local title, pin, and user-asserted Ticket link. A failed scan, omitted list item, or temporary
resume refusal does not establish permanent loss.

Every Ticket also has an Argo UUID and a unique `(provider, provider scope, native Ticket ID)`
identity. Connections provide current access but do not define the Ticket: two Projects connected
to the same provider scope see one Ticket and keep its Argo UUID after reconnect. When a provider
confirms deletion, Argo keeps that UUID, the last known title, and user-asserted links. The UI
groups the Ticket with closed work and gives the reason `deleted`; this does not claim that the
provider reported a closed status. A lost Connection or failed read does not establish deletion.
Adapters distinguish verified permanent loss or deletion from authorization failure, inaccessible
scope, rate limiting, list omission, and transient failure. Only an authenticated native read with
sufficient provider evidence establishes permanent loss or deletion. If the provider cannot prove
which outcome occurred, Argo keeps the local identity and reports uncertainty.

## Sync and reads

Background workers regularly ingest Sessions and Tickets per Harness or Connection. They index all
listed Sessions, recent first, and continue older history in the background. Session search covers
visible user and assistant text plus visible tool summaries read through vendor interfaces.
Ingestion is idempotent, reports progress and freshness per source, and commits each usable result
independently. One source failing leaves other indexed data available and shows a toast for that
source's failure episode. Incomplete scans never delete durable Argo state or imply that an unseen
vendor item is gone.

XState actors remain the owners of ongoing workflows. A Ticket observer actor per Connection will
own scheduling, invalidation, retry, and reconciliation; main-process per-Harness coordination
owns Session sync. Main schedules their ingestion jobs on a bounded set of worker threads. Each
source retains separate priority, progress, retry, and failure state; the number of Connections
does not create an unbounded number of threads. Workers write disposable indexes through their own
SQLite connections to the one per-machine database. Main owns durable Argo writes. The renderer
shows already indexed rows while sync runs, and typed per-domain sync-status reads report
freshness, progress, and errors. After a committed change, a named event invalidates the affected
TanStack queries.
Jobs carry a source generation so results from a disconnected or replaced source cannot commit.
Worker failure retains committed rows and retries with bounded backoff. Workers receive validated
data and no persistent credentials. Main assigns or finds a durable Session UUID before an index
row uses it; a worker crash cannot create a second identity. Priority opens take precedence without
starving background scans.

tRPC is the renderer's typed API for all request-response operations, including domain and platform
commands. Domain routers own their procedures and call domain services; a root router only composes
them. Shared Zod schemas validate inputs and outputs. The renderer uses tRPC's TanStack Query
options directly, with custom hooks only for composed view behavior. Each domain owns its SQLite
tables, queries, migrations, and sync rules; shared infrastructure opens the database and schedules
worker jobs. Vendor adapters retain vendor calls and parsing. The Electron transport must preserve
Argo's trusted-frame authorization; its exact mechanism requires a real Electron security proof.
Procedures carry product commands and projections, never raw XState events or actor snapshots.
Claude's managed Session actor, Codex's supervisor and child actors, the durable ProjectSetup actor,
and the sign-in actors remain as ADR-0047 defines them.

Read operations query SQLite for lists, search, and indexed detail. The backend adds current live
Session projections to those rows and returns one Argo-shaped response; the renderer does not merge
sources. List operations expose numbered pages, page size, indexed total, and stable SQL order.
Pages can shift when sync adds rows, so refresh preserves selection by Argo UUID. Pinned Sessions
come from a separate query and do not appear in the ordinary Session pages. Vendor cursors and
payload shapes stop at the adapter boundary. A separate Feed operation reads vendor history and
transforms it into the same validated Feed shape as live events. Selecting a watched Session shows
that history without opening a live channel. The first new prompt attempts native resume. Live
status and events continue to come from the managed channel and are reconciled with vendor history.

Phase one removes the old operation tables, preload client maps, per-operation channels, and
pass-through renderer hooks as their request-response operations move to tRPC. Named live-stream
channels remain an explicit current boundary. Phase two moves those streams and change events to
tRPC subscriptions. Managed status transitions invalidate Roster queries; token and Feed events do
not refetch the Roster.
A committed Session or Ticket index change invalidates affected lists and selected detail after
the transaction, never before it. Vendor history and live events use stable source event identity
and order so reconciliation fills gaps without duplicate Feed rows.

Argo allows one application instance and one window; a second launch focuses the first. Each
managed Session's XState actor serializes start, resume, and Turn events. Managed or watched posture
comes from the live channel, not a stored Boolean. The adapter checks vendor liveness before native
resume because another vendor client can still hold the Session.

## Mutations and failure

Session titles, pins, and Ticket links mutate Argo-owned durable tables. Ticket mutations call the
provider. The renderer may show an optimistic Ticket value, then Argo commits the provider's
accepted result to SQLite. A definite rejection reverts the view and shows an error. If the
provider outcome is uncertain, or it accepts a mutation but SQLite cannot commit it, the view
marks the value as syncing until reconciliation determines the provider state. An unsafe durable
database blocks further mutations and uses ADR-0043 recovery.
Before a provider Ticket write, Argo durably records an intent ID, target Ticket, base version, and
requested value. The intent is control state, not a claim that the Ticket changed. Conflicting
writes to one Ticket are serialized. Uncertain writes are never
automatically retried; a provider read by immutable native ID reconciles them after failure or
restart. A late response or stale sync result cannot overwrite a newer accepted edit. The syncing
state clears only when the matching provider fact is committed to SQLite.

Procedures return structured domain error codes; tRPC handles transport failures. Session creation
is atomic from the renderer's point of view: success appears only after the vendor returns and
SQLite commits the Argo identity and native ID. If the vendor starts a Session but the database
commit fails, Argo keeps the vendor Session for reconciliation, reports an uncertain result, and
never resends the first prompt automatically. Vendor and SQLite writes do not share a transaction.
The typed start command sends the first prompt through the per-Session Harness actor. After the
vendor supplies a native ID, the Session repository upserts the unique Harness and native ID pair
and assigns or reuses its Argo UUID. A failed SQLite write leaves the start uncertain; the actor
retains any known native ID in process, and later vendor sync can discover the Session after restart.
No launch-intent table or automatic first-prompt retry exists. Concurrent native resume requests for
one Session share one in-flight attempt, and the managed actor handles later Turn events.

## Changes to earlier decisions

This decision extends ADR-0043's authority split: durable Argo Session identity and local fields
coexist with disposable Session and Ticket indexes. It keeps ADR-0047's vendor interface, Feed,
actor, and `managed | watched` boundaries, while superseding its SQLite Session lease and launch-intent requirement. It replaces ADR-0047's vendor-paged Roster merge and
cursor recovery with SQLite paging. It removes the SQLite Session lease because one Argo
instance and its per-Session actors own managed channels; vendor liveness still guards resume.
It supersedes ADR-0039's operation
tables with domain-owned tRPC routers, while retaining the validated boundary and trusted-frame
requirement. No public HTTP server is required.
