# Vendor protocols drive Sessions, and owned workflows use XState

Status: accepted · 2026-09-21

Amended 2026-09-27 for the Session migration in #2793. This amendment governs the Harness
boundary and live Session lifecycle. The vendor interface, Session identity, and Feed rules below
still apply.

Argo reads and drives Sessions through supported vendor interfaces. Claude uses the Claude Agent
SDK. Codex uses `codex app-server`. Argo does not parse transcript or rollout files. A filesystem
watcher can invalidate a Session without a live channel, but the adapter must then read it through the
vendor interface.

A Session has an Argo UUID and a unique `(Harness, native Session ID)` pair in one SQLite table.
The pair identifies the vendor conversation. A live channel is runtime state, not a durable
Session posture. Argo has one application window and uses no Session lease. After a restart,
vendor history remains available and the first new prompt can attempt native resume. The Harness
checks vendor liveness before that attempt.

Each concrete Harness has one compiled-in registration. It declares independent capabilities for
readiness, catalog, discovery, history, rename, and live Sessions. Each supported operation uses an
async function or returns an async live channel. Harness code owns vendor parsing, protocols, and
resources. Production Harness code does not import XState or hold an Argo actor. Argo routes by a
validated Harness ID; shared Session code does not branch on Claude, Codex, or another provider.
The ID remains Session identity data and can appear in catalog and UI projections.

The app machine starts one live Session supervisor. That Argo-owned machine creates one generic
live Session actor per active conversation. The supervisor orders and deduplicates commands, allows
one active Turn per Session, and retires idle actors. The Session actor owns lifecycle and consumes
validated channel events. A renderer reload or Session switch does not stop an active Turn. SDK
clients, processes, streams, sockets, and cancellation handles stay inside the channel or an
invoked Argo actor. Machine context holds only serializable IDs and validated facts. Actor
snapshots are not persisted. The app machine also owns the lifetime of shared vendor clients, such
as one Codex app-server client. These clients are plain async resources, not Harness machines.

IPC carries validated product commands and revisioned projections. It does not carry raw XState
events or XState snapshots. The renderer owns view state only. It does not own connection, Turn,
approval, retry, or resume state.

Vendor events are the immediate Feed source. Each registration reads vendor history for a root
Session or selected subagent without starting a live actor. Vendor history reconciles gaps and
uncertain sends. A failed history read retains known Feed content and reports failure. Argo
reconciles stable identities so a Feed row appears once. A cursor-based subscription delivers live
events. A bounded journal replays recent events after a brief disconnect. An expired cursor
causes a fresh projection and vendor history read. The journal is not a permanent transcript.
Argo never resends an uncertain Turn automatically. The renderer does not create optimistic Feed
rows, optimistic Turns, temporary Session IDs, or a pending-Turn queue. It keeps the draft until
main accepts the send command and restores it after a definite rejection.

Opening or resuming a Session returns a channel before the native Session ID is necessarily known.
Commands have stable IDs; Permission and Question requests have stable request IDs. Argo records
command outcomes and assigns a monotonic sequence to each received event per Session. Channel
acceptance proves delivery acceptance, not vendor execution or Turn completion. A delayed native ID
binds to one Argo Session. After process loss, Argo reads vendor history and reconnects when the
Harness supports it. An uncertain command is never sent again automatically.

ACP is a reusable protocol implementation under a concrete Harness registration. A concrete ACP
agent has its own Harness ID and proves live updates, Permission handling, resume, and vendor-backed
history before Argo offers it as a full Session Harness. ACP is not Argo's internal Session
protocol. Mobile access can use the same serializable product commands, events, and cursors later;
this decision does not add a mobile host.

Claude authorization is subscription-only. Argo does not accept an Anthropic API key or select
API billing. Anthropic's paused billing change means that Agent SDK and third-party app usage
currently draws from subscription limits. Argo will use that path. The separate third-party
approval statement is a distribution-policy risk, not an implementation or release gate. If
Anthropic blocks subscription access or changes its metering, the SDK adapter becomes unavailable.
A future PTY adapter will provide the fallback, but it is deferred and does not shape this
contract.

## Session list and search

The renderer requests numbered Session pages from SQLite through one typed tRPC procedure. Each
page has a size, total count, and stable SQL order. The backend returns Argo-shaped rows without
native IDs or vendor cursors. Saved rows remain visible during sync. A refresh preserves selection
by Argo UUID. Session sync commits valid batches without deleting rows omitted by a scan.

SQLite owns user pins and pinned order. `Pinned Sessions` and `Sessions` are sections of one
virtual list. Only pinned rows can be reordered. Vendor pins and tags do not change Argo's order.

Full-content search uses a disposable SQLite FTS5 index. Vendor interfaces are its only input.
The Session list remains usable while indexing. Index failure cannot change stored Session identity.
Full-content search and its progress display belong to a later slice. The first list milestone
syncs Claude metadata on app start and manual Refresh. Codex metadata sync follows later.

## Other XState boundaries

`ProjectSetup` remains one durable main-process actor per Project. One Attempt uses the same
Harness and native Session for read-only planning and sandboxed application. Routine work inside
the setup worktree does not require approval. A precise write outside the worktree does. Inside the
sandbox, the agent asks only when it needs a product decision or clarification, not for each tool
call.

After application, one code-review pass checks Standards and Spec. The same Session fixes accepted
findings once. Deterministic validation follows. Final diff acceptance authorizes commit, push,
and creation of a draft pull request. The remote default branch, not pull-request state, decides
whether setup has landed. Argo validates required files in a temporary worktree.

Account and Connection records are data, not actors. One temporary main-process sign-in actor owns
GitHub or Linear OAuth for all windows. Tokens and PKCE material stay outside serializable actor
context. Claude and Codex sign-ins use separate Harness-specific actors and are not Account
entities.

Tickets remain provider-owned query data. One Ticket observer actor per Connection owns initial
sync, invalidation, refresh, reconnect, backoff, and reconciliation. A GitHub webhook-forwarder
socket can be a fast invalidation path, with a conditional API read as the correctness floor.
Linear uses polling until Argo has a secure webhook relay. Push never writes Ticket truth directly.

## Consequences

- Delete transcript and rollout parsers, resume-chain reconstruction, private vendor database
  reads, temporary Session identity, and their compatibility paths.
- Reset the development database. There are no users and no legacy migration is required.
- Keep PTY support out of the first adapter contract. Add it later only as another Harness-owned
  adapter if subscription access or metering changes. Keep the existing PTY runtime dependencies
  installed so that the fallback does not require a separate dependency restoration. Keep the
  dormant fallback in one self-contained Claude Harness driver module. Shared Session code and the
  active SDK path must not import it or branch on PTY behavior.
- Test adapters with recorded vendor streams and contract tests. Test XState outcomes rather than
  implementation calls.
- Keep live work alive across renderer reloads. Treat application-process loss as interruption,
  then reconcile before resume.

## Superseded decisions

This ADR keeps ADR-0024's one-integration-per-Harness boundary. The 2026-09-27 amendment replaces
its drive-only port with a registration for live Sessions and history. This ADR also supersedes
that decision's Claude PTY driver, separate Agent SDK billing claim, and transcript-observation
rules.

It supersedes ADR-0008's files-only store, transcript discovery, resume-chain construction, and
file-derived liveness. ADR-0043 now governs the shared SQLite store.

It keeps ADR-0013's rule that Sessions have no kinds. Neither `managed | external` nor
`managed | watched` is a durable Session posture.

It keeps ADR-0026's distinction between a temporary channel and a durable Session. It supersedes
resume-chain identity, transcript-derived liveness, the ownership JSON ledger, and transcript-tip
resume.

It keeps ADR-0040's rule that origin does not gate resume. It supersedes the JSON ownership ledger
and file/process liveness checks with vendor liveness.

It supersedes ADR-0041's user-level compaction hook. Compaction comes from vendor events and
history.

It supersedes ADR-0042. Codex titles and history come from app-server, not Codex's private SQLite
schema.

It keeps ADR-0046's durable main-process `ProjectSetup` actor and validated IPC boundary. It
supersedes separate planning and application Sessions, separate Harness choices, routine
worktree-effect approval, final-diff approval as completion, and publication as a later workflow.
