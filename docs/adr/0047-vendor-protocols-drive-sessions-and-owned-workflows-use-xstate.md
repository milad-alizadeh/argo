# Vendor protocols drive Sessions, and owned workflows use XState

Status: accepted · 2026-09-21

Argo reads and drives Sessions through supported vendor interfaces. Claude uses the Claude Agent
SDK. Codex uses `codex app-server`. Argo does not parse transcript or rollout files. A filesystem
watcher can invalidate a Session without a live channel, but the adapter must then read it through the
vendor interface.

A Session has an Argo UUID and a unique `(Harness, native Session ID)` pair in one SQLite table.
The pair identifies the vendor conversation. A live channel is runtime state, not a durable
Session posture. Argo has one application window and uses no Session lease. After a restart,
vendor history remains available and the first new prompt can attempt native resume. The Harness
checks vendor liveness before that attempt.

Each Harness owns one adapter. Shared Session code owns only validated commands, projections, and
application rules. Claude has one ephemeral main-process actor per live Session. Codex has one
main-process app-server supervisor and one child actor per live Session. Invoked actors own
SDK clients, processes, streams, sockets, timers, and cancellation handles. Machine context holds
only serializable identifiers and validated facts. Live Session actor snapshots are not persisted.

IPC carries validated product commands and revisioned projections. It does not carry raw XState
events or XState snapshots. The renderer owns view state only. It does not own connection, Turn,
approval, retry, or resume state.

Vendor events are the immediate Feed source. Vendor history reconciles gaps and uncertain sends.
Argo never resends an uncertain Turn automatically. The renderer does not create optimistic Feed
rows, optimistic Turns, temporary Session IDs, or a pending-Turn queue. It keeps the draft until
main accepts the send command and restores it after a definite rejection.

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

This ADR keeps ADR-0024's one-adapter-per-Harness boundary. It supersedes that ADR's Claude PTY
driver, separate Agent SDK billing claim, and transcript-observation decisions.

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
