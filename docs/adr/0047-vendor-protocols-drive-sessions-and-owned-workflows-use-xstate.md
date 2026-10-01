# Vendor protocols drive Sessions, and owned workflows use XState

Status: accepted · 2026-09-21

## Amendment · external Session presence (#2940) · 2026-10-01

A Session that runs outside Argo gets its row's status from one poll source for each Harness,
and only these:

- Claude: `claude agents --json`, the agent view's documented way to read Session state from
  outside Claude Code. Its output is validated when read. It gives a status and no activity line.
  Argo reads no `~/.claude/sessions/<pid>.json` pid file.
- Codex: a non-blocking flock probe on `~/.codex/thread-writer-locks/<id>.lock` says the thread is
  open. Node has no flock, so a host helper runs a `/usr/bin/perl` one-liner that takes
  `LOCK_EX|LOCK_NB` and lets go. The host may `stat` the rollout path as a change signal and reads
  none of its content. When the rollout changed, or the lock is no longer held, the adapter asks
  app-server `thread/turns/list` for the newest Turn. A Turn with `completedAt` is idle. A Turn
  without it is running while the lock is held, and unknown once the lock is free, because a crash
  leaves the Turn unfinished too. "Thread not loaded" with the lock held is idle. An error within
  2 seconds of a change is a Turn still starting: it reads as running, and the next poll asks again.

These reads change no Session and drive no resume. This amends the decision below that supersedes
ADR-0040's file and process liveness checks, for the lock probe only. The rule that Argo does not
parse transcript or rollout files stands. Argo installs status hooks in each Harness's user-level
config at launch, with no switch. They post to a Unix socket in Argo's app data folder, and a status
they set outranks the listed one; the poll stays on (#2976). This reverses ADR-0041's removal of a user-level hook, for status only; compaction still
comes from vendor events, as below. As in ADR-0041, an acceptance run installs nothing.

## Amendment · main-owned root Feed reading (#2824) · 2026-09-28

A root Session's Feed has one main-process reader. It attaches to the event journal before it reads
vendor history, reconciles live items with history by stable identity, groups settled tool runs,
and publishes one validated reading: the ordered rows with stable IDs and render revisions, the read
state, any read error, and the waiting Question and Permission. The renderer observes that reading
and asks for Refresh; it holds no replay cursor, joins nothing, and groups no calls. An expired
replay or a new reader reads vendor history afresh. A failed read keeps the rows it had. This
replaces the renderer cursor in the replay amendment below. Subagent chains still use the history
query and raw event route until they move to the same reader (#2882).

## Amendment · Harness registrations · 2026-09-28

Shared Session, platform, and renderer code select Harness behavior by Harness ID through one
registry and never branch on a Harness. A registration declares its capabilities: the Turn
settings a later Send may change, whether it accepts attachments, an optional auto-compact limit,
and an optional shutdown. The renderer reads each Harness's label, logo, extra context details,
standing-allow scope, and plan usage from one presentation registry, and each name from the
Harness's own locale catalog. Only the Harness ID list and the registry files under
`src/harnesses/` name a Harness; everything else vendor-specific lives in
`src/harnesses/<harness>/`, and a dependency-cruiser rule keeps shared code out of it. Harness
code imports no XState.

The app machine owns the shared Codex client through the registration's shutdown; no Codex
app-server machine exists. The Harness catalog machine lives under
`src/platform/main/harness-catalog/`.

A Session without a live channel has no Feed change signal. Its Feed stays as last read until the
reader reopens it or asks for Refresh. Its row's status and activity line come from the poll in
ADR-0048.

## Amendment · Codex live Session channel · 2026-09-28

The Codex registration now opens an async channel through the application-owned, shared app-server
client. The generic live Session machine owns each Codex Session lifecycle and the supervisor orders
its commands. Codex Harness code imports no XState. A Codex channel failure affects its Session; the
app-server client and other Harnesses remain application-owned resources.

Codex turn and item notifications carry stable vendor IDs into the same validated Feed event
contract as Claude. Vendor history settles those rows. The Feed reads each chain's complete
history through `thread/read` as one snapshot and merges live events into it; it has no pages.

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
application rules. Every Harness has one generic, ephemeral main-process actor per live Session,
which opens the live channel its registration supplies. Invoked actors own
SDK clients, processes, streams, sockets, timers, and cancellation handles. Machine context holds
only serializable identifiers and validated facts. Live Session actor snapshots are not persisted.

IPC carries validated product commands and revisioned projections. It does not carry raw XState
events or XState snapshots. The renderer owns view state only. It does not own connection, Turn,
approval, retry, or resume state.

Vendor events are the immediate Feed source. Vendor history reconciles gaps and uncertain sends.
Argo never resends an uncertain Turn automatically. The renderer does not create optimistic Feed
rows, optimistic Turns, temporary Session IDs, or a pending-Turn queue. It keeps the draft until
main accepts the send command and restores it after a definite rejection.

## Amendment · replay and command recovery · 2026-09-28

Argo keeps recent live events in a bounded memory journal. Each Session has an ordered sequence.
A replay request includes the journal generation, which changes when Argo restarts. A subscription
attaches before replay starts. If its cursor expires, the Feed reads vendor history and merges rows
by stable item ID. SQLite stores no live event payload or second transcript.

The supervisor records a command ID and its outcome before it calls a Harness. It also records the
draft revision that sent the command. After a restart, Argo marks each unfinished command unknown.
It reads vendor history when it knows the native Session ID. A matching Claude user item or Codex
turn ID proves that the vendor saw the command. Argo never sends an unknown command again on its own.

An actor retires after five minutes when the Harness reports idle and the actor has no queued
command. The Session row and vendor history remain. A new prompt attempts native resume.

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

## Amendment: Harness registrations for Session history (#2795)

Desktop startup assembles one descriptor for each concrete Harness. Each descriptor provides
readiness, sign-in, vendor history, and supported Session mutations. Readiness works before a
Project or Session exists. Registration implementations have no XState imports. Argo machines
still own application and live Session lifetimes during the migration.

The Feed reads the selected descriptor with the root native Session ID, optional subagent ID,
and working directory. It keeps the Argo Session UUID and selected chain ID in the response.
A vendor read failure reports an error and does not confirm an empty Feed. This amends the
machine-per-Harness boundary above as the migration replaces vendor machines with async clients.

## Amendment: Claude live channel (#2798)

The Claude registration opens an async Session channel. The channel owns the Agent SDK query and
emits validated identity, command, Turn, control, Feed, failure, and closure events. It contains no XState.
The Argo live Session machine owns the channel lifetime. The supervisor orders commands and keeps
active Turns alive when the renderer changes Sessions or reloads.

Argo records small command outcomes before it calls Claude. A duplicate command ID does not start
another Turn. If Argo loses the process before it can establish the outcome, the command stays
uncertain. Argo reads vendor history and does not send that command again automatically. This
replaces the Claude machine boundary described above.
