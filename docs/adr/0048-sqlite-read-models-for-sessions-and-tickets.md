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

Vendor Session metadata, searchable history text, and Ticket content live in disposable SQLite
query tables. Their providers remain authoritative. The Ticket index covers the active backlog and
Tickets linked to Argo work. Search tells the reader when older Ticket history is not indexed. A
missing Session or Ticket opened by direct reference gets a priority sync and a loading state until
its row is committed. A vendor-confirmed permanently unrecoverable Session is removed with its
local title, pin, and user-asserted Ticket link. A failed scan, omitted list item, or temporary
resume refusal does not establish permanent loss.

## Sync and reads

Background workers regularly ingest Sessions and Tickets per Harness or Connection. They index all
listed Sessions, recent first, and continue older history in the background. Session search covers
full conversation text read through vendor interfaces. Ingestion is idempotent, reports progress
and freshness per source, and commits each usable result independently. One source failing leaves
other indexed data available and shows a toast for that source's failure episode. Incomplete scans
never delete durable Argo state or imply that an unseen vendor item is gone.

One validated, API-style IPC contract is the renderer's interface for Session and Ticket reads and
commands. Read operations query SQLite for lists, search, and indexed detail. The backend gives
the renderer one Argo-shaped response and owns pagination; vendor cursors and payload shapes stop
at the adapter boundary. A separate Feed operation reads vendor history and transforms it into the
same validated Feed shape as live events. Selecting a watched Session shows that history without
opening a live channel. The first new prompt attempts native resume. Live status and events
continue to come from the managed channel and are reconciled with vendor history.

Argo allows one application instance and one window; a second launch focuses the first. A separate
SQLite Session lease retains an owner token and expiry. Managed or watched posture comes from the
live channel, not a stored Boolean. The lease protects Argo's own resume path after overlap or
crash but does not prove that another vendor client is absent. The adapter checks vendor liveness
before native resume.

## Mutations and failure

Session titles, pins, and Ticket links mutate Argo-owned durable tables. Ticket mutations call the
provider. The renderer may show an optimistic Ticket value, then Argo commits the provider's
accepted result to SQLite. A definite rejection reverts the view and shows an error. If the
provider outcome is uncertain, or it accepts a mutation but SQLite cannot commit it, the view
marks the value as syncing until reconciliation determines the provider state. An unsafe durable
database blocks further mutations and uses ADR-0043 recovery.

## Changes to earlier decisions

This decision extends ADR-0043's authority split: durable Argo Session identity and local fields
coexist with disposable Session and Ticket indexes. It keeps ADR-0047's vendor interface, Feed,
actor, and `managed | watched` boundaries. It replaces ADR-0047's vendor-paged Roster merge and
cursor recovery with SQLite paging. It changes the lease's reason from protecting multiple Argo
windows to protecting one instance against overlap and crash. It follows ADR-0039's operation-table
IPC boundary; no HTTP server is required.
