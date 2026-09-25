# SQLite read models for Sessions and Tickets

Status: accepted · 2026-09-24

The Session list currently mixes vendor pages with SQLite metadata. The renderer must reconcile
source cursors and Argo-owned fields, so paging and search depend on adapter behavior. Ticket
queries have a similar split. Argo will give the renderer one validated IPC read surface backed by
SQLite for Sessions and Tickets. Live connections and mutations still go through their Harness
machines and vendor interfaces. Delivery facts, including pull requests and CI, need a separate design.

## Identity and ownership

One Session table holds the Argo UUID, unique `(Harness, native Session ID)` pair, and indexed
vendor metadata. Argo creates the row after a Session it starts receives a native ID. Later sync
finds the same UUID. The pair remains the vendor identity for history and resume. Forks are
separate Sessions. The Project link is nullable and clears when its Project is deleted. A new
working directory can move a Session to another Project. A missing directory preserves the known
Project. Argo owns pins, pinned order, and user-asserted Ticket links.

One custom title follows the vendor across Argo and other clients. An authoritative vendor read
can replace or clear it. Sparse metadata does not erase other known values. The display order is
custom title, linked Ticket title, vendor preview, then first prompt. Linking a Ticket does not
copy its title or rename the vendor Session. Claude supplies its custom title separately. Its
summary becomes a preview only when distinct. Codex supplies name and preview separately.
Argo does not read a transcript to manufacture a preview. A later slice adds vendor-backed rename.
The effective Ticket link follows ADR-0017: a positive branch-derived Delivery-to-Ticket link wins;
an asserted Delivery-to-Ticket link fills only an unlinked derivation; a branchless Session can
assert its own Ticket link. An asserted link survives provider disconnection and Ticket deletion.

Vendor Session metadata shares the Session table with Argo identity. Searchable history text and
Ticket content can use disposable SQLite query tables. Their providers remain authoritative. The
Ticket index covers the active backlog and
Tickets linked to Argo work. Search tells the reader when older Ticket history is not indexed. A
missing Ticket opened by direct reference can get a priority sync and a loading state until its
row is committed. The first Session list milestone has no priority open sync. A vendor-confirmed
permanently unrecoverable Session can be removed with its pin and user-asserted Ticket link. A
failed scan, omitted list item, or temporary resume refusal does not establish permanent loss.

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

The app XState machine owns one long-lived Session sync worker bridge. It shuts the worker down
with the app. The worker contains one reusable XState sync machine definition and runs one
instance per Harness. Each instance invokes its Harness fetch actor and a batch-save actor.
Machine context holds serializable progress and identity, not an SDK client or SQLite connection.
The worker opens its own SQLite connection after main-process migrations. SQLite WAL and a busy
timeout coordinate writes from main and worker. A worker failure retains committed rows.

The first milestone syncs Claude Session metadata at app start and on manual Refresh. It scans
all listed metadata without a watermark or transcript history. The Claude reader lists external
interactive Sessions and fetches known Argo-created Sessions by native ID. This excludes unrelated
headless SDK runs while detecting external renames of Argo Sessions. The reader validates each
vendor result and skips and counts malformed records. It passes typed metadata to the shared
Session upsert. Valid batches commit as they finish. A failed fetch or SQL batch gets three total
attempts. A batch retry does not fetch vendor data again. Incomplete scans do not delete rows.
There is no automatic five-minute poll in this milestone.

The existing Session list shows saved rows while sync runs. It shows indeterminate progress until
the fetch knows the total, then processed count over total. Refresh stays disabled through sync
and retry. After success, the list shows a relative last-synced time. A partial scan shows one
toast with the skipped count. A terminal fetch or save failure shows one toast. A subscription
sends current sync status on subscribe, then progress and committed-change signals. The renderer
refetches the SQL list after a commit.

Codex metadata sync later reuses the same worker and machine definition. Its fetch actor requests
thread data through the existing main-process Codex app-server actor over a narrow bridge. It
does not start another Codex process. Codex parsing stays in its Harness. Ticket observers remain
separate owners of Ticket provider sync.

## Module ownership

The shared table definitions and database lifecycle live under `apps/desktop/src/database/`.
Session SQL reads and writes live under `apps/desktop/src/domains/sessions/main/`. Name the
shared write `session-upsert.ts`, the list handler `session-list.ts`, and the worker machine
`session-sync-machine.ts`. Keep the worker entry and bridge beside the sync machine and app
machine, respectively. Claude and Codex metadata readers and their response schemas live under
their own `apps/desktop/src/harnesses/<harness>/` folders. Name the live machines
`live-session-supervisor-machine.ts`, `live-session-machine.ts`,
`claude-live-session-machine.ts`, and `codex-live-session-machine.ts`. The sync machine does
not own a live channel. These names describe ownership; they do not require new contract layers.

tRPC is the renderer's typed API for request-response operations. One global router registers
procedures. A Session list handler owns its SQL read and colocated Zod input and output schemas.
The renderer uses tRPC's TanStack Query options directly, with custom hooks only for composed view
behavior. A top-level `src/database` module owns all Project, Session, and Ticket table
definitions, plus the connection, migrations, backup, and recovery. Domain modules own their
queries and writes. One Session domain upsert takes a database connection and typed metadata;
its input type lives beside it. Both the live Session actor and worker call it. It creates an
Argo UUID only on first insert. Harness readers own vendor response schemas and parsing. API
schemas live beside handlers, live actor types beside their machines, renderer-only types beside
consumers, and the generic tRPC message schema beside transport. No new Session contract folder,
Session repository, or second normalized-record parser is needed. Old contract files leave as
their owning slices replace them. The Electron transport keeps trusted-frame authorization.
Procedures carry product commands and projections, never raw XState events or actor snapshots.
One app-scoped live Session supervisor actor receives those commands. It spawns one live Session
actor per live conversation, correlates command IDs with results, and owns shutdown. Each actor
invokes its selected Claude or Codex live Session Harness machine directly. The shared Codex app-server actor,
ProjectSetup actor, and sign-in actors remain separate owners of their work.

Read operations query SQLite for lists, search, and indexed detail. The backend adds current live
Session projections to those rows and returns one Argo-shaped response; the renderer does not merge
sources. List operations expose numbered pages, page size, indexed total, and stable SQL order.
Pages can shift when sync adds rows, so refresh preserves selection by Argo UUID. Pinned Sessions
come from a separate query and do not appear in the ordinary Session pages. Vendor cursors and
payload shapes stop at the Harness boundary. A separate Feed operation reads vendor history and
transforms it into the same validated Feed shape as live events. Selecting a Session without a
live channel shows that history without opening one. The first new prompt attempts native resume.
Live status and events are reconciled with vendor history.

Phase one removes the old operation tables, preload client maps, per-operation channels, and
pass-through renderer hooks as their request-response operations move to tRPC. Named live-stream
channels remain an explicit current boundary. Phase two moves those streams and change events to
tRPC subscriptions. Live status transitions invalidate Session list queries; token and Feed events
do not refetch the Session list.
A committed Session or Ticket index change invalidates affected lists and selected detail after
the transaction, never before it. Vendor history and live events use stable source event identity
and order so reconciliation fills gaps without duplicate Feed rows.

Argo allows one application instance and one window; a second launch focuses the first. A Session
has no durable `managed | watched` posture and no SQLite lease. Its live channel is runtime state
owned by its Session actor. After process loss, Argo reads vendor history before attempting native
resume. The Harness checks vendor liveness before resume; Argo does not infer it from a local row.

## Mutations and failure

Pins and Ticket links mutate Argo-owned durable fields. A later Session rename mutation calls the
vendor and saves its confirmed custom title. Ticket mutations call the provider. The renderer may
show an optimistic Ticket value, then Argo commits the provider's
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
is atomic from the renderer's point of view: success appears only after the vendor accepts the
first prompt and SQLite commits the Argo identity and native ID. The Session actor queues later
prompts during start and persistence, then sends them in arrival order through the same Harness
machine. The supervisor deduplicates the first command ID, including a failed attempt, so a retry
does not pay for another vendor Session. If SQLite fails after vendor creation, the supervisor
retains the failed child for same-process reconciliation and reports failure. It never resends the
first prompt automatically. After process loss, vendor discovery must establish the native ID
before Argo claims a Session exists. There is no launch-intent table or Session lease in this
creation path. Vendor and SQLite writes do not share a transaction.

## Changes to earlier decisions

This decision extends ADR-0043's authority split. One Session table holds Argo identity and
vendor metadata, while Ticket and history indexes can be disposable. It keeps ADR-0047's vendor
interface, Feed, and live actor boundaries. It replaces ADR-0047's `managed | watched` posture,
lease, vendor-paged Roster merge, and cursor recovery. It supersedes ADR-0039's operation tables
with one global tRPC router and colocated handlers and schemas. The validated boundary and
trusted-frame requirement remain. No public HTTP server is required.
