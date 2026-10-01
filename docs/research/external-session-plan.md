# Session status, activity and Feed from vendor APIs: revised proposal

This proposal combines the first draft with two blind gap reviews and a repo search. The sources are
`external-session-status-and-activity.md`, `claude-live-session-status-and-activity.md`,
`agent-cockpit-prior-art.md` and `external-session-feed-streaming.md` in this folder.

"Live" means a Session that Argo runs. "External" means a Session that runs in a terminal, an IDE or
another app.

## What #2940 ships

- One poll every 2 s, with one source for each Harness. No file watcher for Session history.
  Startup reads no history.
- Claude: `claude agents --json`, one run at a time, validated when read. `busy` is `running` and
  `idle` is `idle`. `waiting` is `permission` for "permission prompt", "sandbox request" and
  "worker request", and `asking` for "input needed" and "dialog open". An undocumented value shows
  `unknown` and is counted. Several entries for one Session show the most urgent. A background
  Session is not listed. The command gives no activity line, and Argo reads no pid file.
- Codex: a held flock on `~/.codex/thread-writer-locks/<id>.lock` means the thread is open. The
  first sight of a rollout only records its stat. A change in its size, modification time or inode
  asks `thread/turns/list {limit: 1, itemsView: 'full'}`. `completedAt` set means idle. `completedAt`
  null with the lock held means running, and with the lock free means unknown. "Thread not loaded"
  with the lock held means idle. An error in the first 2 s after a change means running, and the
  next poll asks again. A thread whose lock is no longer held gets one last read.
- The Codex activity line is the newest Turn's activity by the Feed's own rules.
- A listing that fails leaves the rows as they are and is reported once.
- Both sources sit behind one Harness-neutral capability, `externalSessions`, so hooks can switch
  the poll off (#2976).
- The rest of this file is the research that led there.

## Principle

Each vendor's own API answers everything that it can answer. Argo keeps a poll only to know when
to ask. Argo parses no transcript. A Codex writer lock tells a running external Turn from a crashed
one, because the API reports both as unfinished.

## The matrix

| Case | Source | Watchers | Our parsing | Cost |
|---|---|---|---|---|
| Claude live: status | SDK `SDKSessionStateChangedMessage` with `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1` | none | none | cheap |
| Claude live: activity, Feed | SDK `query()` stream (no change) | none | none | cheap |
| Claude external: discovery | a listed `sessionId` with no row, from `claude agents --json` | none | none | in the status run |
| Claude external: status, open elsewhere | `claude agents --json` every 2 s, grouped by `sessionId` | none | validate the JSON array | one process run each tick |
| Claude external: activity | none until hooks (#2976); the row keeps its stored line | none | none | none |
| Claude external: Subagents | SDK `listSubagents`, `getSubagentMessages` | none extra | none | for each change |
| Claude external: Feed | `getSessionMessages`, diffed by message `uuid` | none extra | none | for each change of the open Session |
| Codex live: status | `thread/status/changed` | none | none | cheap |
| Codex live: activity, Feed | Argo's app-server (no change) | none | none | cheap |
| Codex external: discovery, activityAt | a held lock with no row; a rollout stat change moves `activityAt` | none | none | one stat for each held lock each tick |
| Codex external: open elsewhere | a non-blocking flock probe on `~/.codex/thread-writer-locks/<id>.lock` every 2 s | none | none | one probe process each tick |
| Codex external: status | the newest Turn's `completedAt` from `thread/turns/list`, with the lock state | none | none | 14 ms, on a rollout change |
| Codex external: activity | `thread/turns/list {limit:1, itemsView:'full'}` on a change | none extra | none | 14 ms, one request in flight |
| Codex external: Subagents | spawn items in the newest Turn | none extra | none | to verify |
| Codex external: Feed | `thread/read`, then `thread/turns/list {limit:1}` replaces the current Turn by its id | none extra | none | 14 ms for each change |

The per-file watchers exist because macOS can miss writes to an open rollout. A rollout gets written
only while its lock is held, so per-file watchers are needed only for held locks.

## Status mapping

Both Harnesses write the same Session status vocabulary: `starting`, `running`, `permission`, `asking`,
`idle`, `stopped`, `ended` and `unknown`.

| Source value | Session status |
|---|---|
| Claude `busy` / SDK `running` | `running` |
| Claude `waiting` with `waitingFor` "permission prompt", "sandbox request" or "worker request", SDK `requires_action` on a permission | `permission` |
| Claude `waiting` with "input needed" or "dialog open", SDK `requires_action` on a question | `asking` |
| Claude `idle` / SDK `idle` | `idle` |
| Claude Session gone from `claude agents --json` | `idle` |
| Claude listed `busy` with no change for five minutes | `running`, since every listing is fresh |
| Claude undocumented `status` or `waitingFor` | `unknown`, counted |
| Codex newest Turn has `completedAt` | `idle` |
| Codex newest Turn has no `completedAt`, lock held | `running` |
| Codex newest Turn has no `completedAt`, lock free | `unknown` |
| Codex "thread not loaded", lock held | `idle` |
| Codex read-settled `running` with no rollout change for five minutes | `unknown` |

Parity gap: an external Codex Session cannot show `permission` or `asking`, because no source reports
those states. A Codex row in that state shows `running` or `unknown`. The PR states this.
An external Claude Session shows no activity line, because `claude agents --json` gives none.
Hooks add both (#2976).

## Rules found by the reviews

1. Discovery stays. A listed Session with no row gets `Discover`. A Codex rollout change moves
   `activityAt` for the Session List order.
2. Closed Sessions get a status. A Session that leaves the listing shows `idle`; a Codex thread gets
   one last read first. The first poll sets every saved Session it does not find live to `idle`.
3. Argo's own Sessions are skipped. A Session with a live channel gets no write from the poll.
4. One Session can have several Claude entries. The most urgent status wins.
5. Reads are queued. One activity read runs at a time across all Sessions, with at most one
   follow-up for each Session. Writes for one Session merge into one write each 500 ms.
6. Codex requests are capped. One `thread/turns/list` runs at a time. The poll never calls
   `thread/read`.
7. An idle Session keeps its line, as #2940 requires.
8. Startup reads no history. The first sight of a rollout only records its stat.
9. Vendor names stay in the adapters. The registration has one Harness-neutral capability,
   `externalSessions`: `listLive()` and an optional `readActivity(nativeId, changedAt)`. The poll
   code knows no vendor names. The ACP Harness implements neither.

## Spikes

- Testing "held" for a Codex lock: a non-blocking `flock` probe from a child process, on the held
  locks only. The lock stays a hint, verified on macOS only.
- Codex Subagents from `thread/turns/list` items: left to the Feed change.

## Testing (the stub rule: only the CLI or the Codex app-server is mocked)

- `claude agents --json` is a mock `claude` executable that prints recorded 2.1.286 output.
- The mock app-server answers `thread/turns/list` with recorded output, and a test holds a real
  lock from a child process.
- The tests read rows through the Session List. They cover running with no Feed, idle keeping its
  line, a thread that leaves, a rewritten rollout, discovery, a failing listing, and live winning
  over stored, for both Harnesses.

## What goes, from the repo search

| Path | Lines | Verdict |
|---|---|---|
| `src/harnesses/host/history-watch.ts` + test | 383 + 233 | Remove. The poll replaces it |
| `claude/session/claude-history-lines.ts` + test | 178 + 248 | Shrink to `jsonObject` and `historyRecord`, which skills use |
| `codex/session/codex-history-lines.ts` + test | 165 + 253 | Shrink to the turn markers and the owner from the path, about 45 lines |
| `domains/sessions/main/live/session-history-followers.ts` + test | 67 + 97 | Remove |
| `domains/sessions/main/api/watched-session-status.ts` + test | 53 + 86 | Remove (the poll replaces it) |
| `feed/feed-reader.ts` `followHistory` path | about 50 | Shrink |
| `session-list.ts` Session List Feed readers | about 45 | Remove (the branch already removes it) |
| `database/session-subagents.ts` `recordLiveSubagents` | about 35 | Move to the SDK or app-server input |
| `HistoryFiles`, `HistoryChange`, `HistoryTurnMarker` in `registration.ts` | about 25 | Replace with the new capability |
| `e2e/sessions/real-harness/transcript-feed-corpus.ts` and helpers | 334 + 76 | Rewrite on the vendor readers |
| Branch only: rollout decoder, shell words, mock history lines | 394 | Remove |
| ADR-0048 | | Rewrite. ADR-0047 already says "Argo does not parse transcript or rollout files" |

knip runs with `--max-issues 0`, so each change removes the exports it orphans: `latestTurn`, the
owner helpers, `SessionHistoryFollowers`, `WatchedSessionStatus` and `HistoryFiles`.

## Split and size

1. Presence and status (#2940). The capability, the Claude listing, the Codex locks, the status
   mapping, the Codex activity line, the merged write, and the removal of Session List Feed readers and
   per-file watchers.
2. Live status from the vendors. The SDK state event and `thread/status/changed`. About +80 / -100.
3. External Feed and Subagents through the APIs. Removes the decoders, the followers and the tail.
   About +700 / -2,100.

Each change ships on its own and leaves the app working. Spikes come first.

## Appendix: first-round review findings (kept as reported)

### Reviewer A, correctness and coverage

1. The proposal drops discovery of new Claude Sessions. Confirmed: `main.ts:441` sends `Discover` when a transcript write names an unknown owner, and the pid registry is "best-effort, not a census". Fix: keep one recursive root watcher for discovery.
2. Closed external Sessions never refresh. Confirmed: only the history watcher writes `status` (`schema.ts:23`). A dead pid stays "running". Fix: write a terminal status on pid exit and sweep at startup.
3. Subagents regress. Confirmed: `main.ts:439` feeds `recordLiveSubagents` from decoded watcher events. Fix: use SDK `listSubagents` and `getSubagentMessages`. Codex needs a spawned-thread mapping.
4. The status vocabulary does not match. Confirmed: `SESSION_STATUSES` (`session-live-event.ts:15`). `requires_action`, `waiting` and Codex have no mapping, and a Codex row cannot show `permission` or `asking`. Fix: a mapping table, with Codex external shown as `unknown`.
5. The handoff from live to external is unspecified. Plausible: Argo's own SDK run writes a pid file, and Argo's app-server holds Codex locks. Fix: skip entries that Argo's process tree owns.
6. Codex detection relies on locks. Plausible: older CLIs, crash cleanup, Windows and Linux are not covered, and `writer_lock.rs` was not read. Fix: treat the lock as a hint, verified on macOS only.
7. Rewinds, compaction and forks break the append-by-count Feed. Plausible. Fix: compare message UUIDs and rebuild on a mismatch.
8. Several clients and pid reuse. Plausible: one `sessionId` can have two pid files, and a recycled pid looks alive. Fix: group by `sessionId`, let any `busy` win, and check `procStart`.
9. Cost and the worker thread. Plausible: the parse runs on the main event loop unless the worker works, and the SQLite path through the worker is not stated. The plan keeps `latestTurn` for Codex. The ACP Harness is not mentioned.
10. Machine sleep. Plausible: timers resume stale. Fix: scan again on the power-resume event.
11. A rule check. Confirmed: the poll needs a Harness-neutral "external presence" capability on the registration.

### Reviewer B, performance, reliability and operability

1. The worker thread for `getSessionMessages` is not proven. Plausible, high: there is no Worker or utilityProcess in `apps/desktop/src`, and a packaged bundle needs an entry, an unpacked ASAR and the bun pin. Fix: spike the packaged build first.
2. The poll cost does not scale. Confirmed arithmetic: 20 busy terminals would fill a core. Fix: one queue with a concurrency of 1, no overlap, back-off to 30 s, and visible Sessions only.
3. The Codex activity path cannot be tested under the stub rule. Confirmed: `mock-codex-live.mts:283-297` answers -32601 for anything other than `thread/read`, and `RequestParams` (`codex-app-server-client.ts:40-75`) has no `thread/turns/list` on main. Fix: add both.
4. The `<pid>.json` and lock paths cannot be tested. Plausible. Fix: inject the home folders, write a pid file with the runner's pid, and hold a real lock.
5. Detecting a "held" lock is unspecified. Plausible: Node has no `flock`, and `lsof` costs tens to hundreds of ms. Fix: check shown Sessions only, cache for 5 s, and spike the cost.
6. `fs.watch` on the lock folder sees no content events. Plausible: only create and unlink fire, an atomic rename makes per-file watchers stale, and crashes leave stale files. Fix: watch the folders and reconcile every 10 to 30 s with `kill(pid, 0)` and the process start time.
7. The append-by-count Feed is wrong for Claude. Plausible, high: the `parentUuid` chain changes after a compaction or rewind. Fix: diff by `uuid` and replace the whole Feed when the last one is missing.
8. Status and activity writes can arrive out of order. Plausible: two sources write the same row. Fix: a sequence number for each Session.
9. Startup with thousands of Sessions. Plausible. Fix: show the stored status and read only the pid files and the held locks.
10. One app-server in a burst. Plausible: `thread/turns/list` queues behind a 3.2 s `thread/read`. Fix: one request in flight, and no `thread/read` on the burst path.

### Repo search

The removal table above comes from this search. Its other findings:

- Removals break three things the first draft did not mention:
  - `Discover`: `updateHarnessSession` returning false.
  - `activityAt`, which sets the Session List order.
  - `recordLiveSubagents`.
- `session-command-outcomes.ts:78` `readHistory` is a different function and stays.
- `claude-skill-records.ts` needs `historyRecord`, `jsonObject` and `ClaudeSkillDirectoryScan`.
- A Claude Session started outside Argo has no pid file after its process exits, so its history alone must show it as closed.
- More simplifications:
  - `HistoryTurnMarker.turnId` goes once the Claude scan goes.
  - `followHistory` goes from `SessionFeedReaders`, which saves about 40 lines in `session-feed*.vitest.ts`.
  - The `observeFeed` parameter goes from `session-list-caller.ts`.
  - The idle refresh in `#receive` may become redundant.
- knip orphans to remove in the same change: `latestTurn`, `claudeHistoryOwner`, `codexHistoryOwner`, `SessionHistoryFollowers`, `WatchedSessionStatus` and `HistoryFiles`.

## Appendix: second-round review findings (Opus)

### Reviewer D, performance, reliability, testability

1. The Claude activity read costs as much as the whole file on every change. Confirmed by measurement:
   - With `{dir}`, one read takes 204 ms on a 65 MB transcript and 510 ms on a 238 MB one. RSS rises by 255 MB and 711 MB.
   - `limit:5` still takes 462 ms, because paging counts from the start.
   - One read sends a 24 MB payload over IPC.

   Fix: build the activity line from the incremental tail, and use `getSessionMessages` only when a Feed opens.
2. The last activity of a turn is lost. Confirmed by reading the plan. Rule 5 skips a Session with a read in flight, rule 7 drops a result older than the newest status change, and the poll runs only while `busy`. Fix: one read at a time for each Session, then one more read if a change arrived during it. Drop rule 7.
3. The Codex watchers cannot see a resumed thread. Confirmed by probe:
   - FSEvents gives 0 events for writes to an open file descriptor, against 5 for append-and-close.
   - It gives 0 events when an existing `.lock` is reopened.
   - Codex keeps its rollouts open.
   - On macOS, `lsof` shows an open descriptor and no lock mark.
   - `lsof +D` takes 0.27 to 0.54 s. `lsof -a -p $(pgrep -d, -x codex) -Fn` takes 78 ms.

   Fix: a scoped `lsof` poll is the one source for "held". Drop the lock folder watcher.
4. `thread/turns/list` may not be callable or cheap. Plausible: the method is experimental and Argo sends `experimentalApi: false`. My note: this is contradicted by the measurement in this session. `thread/turns/list` answered with `experimentalApi: false` in 14 ms cold on a 249 MB rollout. The ticket branch adds the generated `ThreadTurnsListResponse` type.
5. The `procStart` check cannot work as written. Confirmed: the pid file and `ps -o lstart` use different formats and timezones, and every check starts a process. The #87131 quiet rule already covers a stuck `busy`.
6. Synchronous scans block the main thread. Confirmed: a recursive `readdirSync` over 12.5k entries takes 96 to 425 ms warm and 796 ms cold (`history-watch.ts:72`, `locate()` at :86). Fix: scan asynchronously, and keep an index from id to path that the root watcher updates.
7. "Directory events only" would miss Claude activity. Confirmed: FSEvents reports Claude appends as `rename`, and Claude does not keep its `.jsonl` open. Fix: the root watcher accepts `rename` events.
8. Some tests are hard to write as planned. Plausible:
   - The SDK reads `CLAUDE_CONFIG_DIR` once per process, so an injected home needs one process per test.
   - Unit tests run on Ubuntu, where inotify sees writes to an open descriptor, so the macOS miss shows only in the macos-26 e2e.
   - The child process holds the descriptor open rather than a `flock`.
9. A skip by process tree needs a ppid lookup, and Node has none. Fix: skip by live native id, or by the pid of Argo's app-server in the `lsof` output.

What the plan can drop: the `procStart` check and pid-reuse handling, the sequence numbers in rule 7, the lock folder watcher, and the utilityProcess if the tail stays. The in-process event-loop lag peaked at 10 ms.

### Reviewer C, correctness and coverage (Opus)

1. The plan contradicts ADR-0047 and does not say so. Confirmed: ADR-0047 removes "private vendor database reads" and "file/process liveness checks", and it says "Argo does not parse transcript or rollout files" (lines 47, 135 and 160-165). Fix: name ADR-0047 as amended, or use `claude agents --json`.
2. A crashed Codex turn stays `running` forever. Confirmed: there are 17 stale lock files from Aug 7 that are not held according to `lsof`, and the plan deletes the 5-minute quiet timer (`watched-session-status.ts:4`). Fix: a quiet limit and an `lsof` check again on each row with an open marker.
3. `ended` and `stopped` show as failed (red). Confirmed (`session-row.tsx:19-28`). Fix: a closed Session gets `idle`.
4. Ticket 2 rests on false claims. Confirmed:
   - The SDK state event carries only `state` (`sdk.d.ts:5532-5538`), so it cannot tell a permission from a question.
   - An MCP elicitation also reports `requires_action`.
   - The Codex half already ships (`codex-session-channel.ts:163-174`).

   Fix: keep `canUseTool` for the waiting kind, and drop the Codex half.
5. Ticket 1 does not stand alone. Confirmed: `recordLiveSubagents` gets its input from the `watchHistoryActivity` callback (`main.ts:441`), and the Feed tail shares the per-file watcher (`history-watch.ts:186-230`). Fix: move the Subagent input in ticket 1, or keep the watchers of the tail until ticket 3.
6. Claude Subagents get no label or state. Plausible: `listSubagents` returns only IDs (`sdk.d.ts:1084`), and a delegation starts only when the result text has `agentId:` (`claude-feed-projection.ts:147-150`). Fix: state this limit, or find the link another way.
7. The Codex Feed loses the end of a Turn. Confirmed by logic: with `limit:1`, a new Turn that starts between polls hides the last items of the old Turn, and the status says `interrupted`. Fix: read 2 Turns when the id changes, and take the status from the markers.
8. Rule 7 leaves an old line at idle. Plausible. Fix: read once more after the status change.
9. The Claude status mapping is incomplete. Confirmed: `waitingFor` has 5 values, and sandbox, worker and dialog are not mapped. Issue #36213: `/clear` leaves the old `sessionId` in the pid file. Fix: an exhaustive mapping, a count of unknown values, and handling for #36213.
10. "No marker = unknown" is a regression. Confirmed: a Turn whose opening marker is more than 1 MB back shows `running` today (`turn ?? 'open'`).
11. Codex Subagent threads can show as top-level rows. Plausible: `thread/read` discovery has no source filter (`codex-session-discovery.ts:79-90`). Fix: filter Subagent threads at discovery.
12. Rule 3 is costly. Plausible: a check of the process tree and `procStart` needs `ps`. Fix: skip entries whose `sessionId` has a live channel.
13. The test plan breaks repo rules. Plausible: a test that writes `<pid>.json` itself skips the CLI mock. Fix: the mock CLI writes recorded shapes, including the stray `}` from #96438.
14. `thread/turns/list` is not grounded. Plausible: main has no generated params type, and the branch casts the response without validation (`codex-session-history.ts:341`). My note: it answered with `experimentalApi: false` in this session. Validation at the boundary is still missing.

## Decisions after round 2

Settled by the findings:

- A closed Session gets `idle`, never `ended` or `stopped`.
- Rule 7 (sequence numbers) goes. Each Session gets one read at a time, and one more read runs if a change arrived during it.
- The `procStart` check, pid reuse and the process tree check go. An entry whose `sessionId` has a live channel is skipped.
- "Open elsewhere" for Codex comes from one scoped `lsof` poll on the Codex processes (78 ms), not a watcher on the lock folder.
- A Codex row with an open marker gets the 5-minute quiet limit and an `lsof` check again. A missing marker keeps today's fallback `running`, under the same limit.
- The root watchers accept `rename` events, and the scans run asynchronously with an index from id to path.
- On a Turn id change, the Codex Feed reads 2 Turns and takes the status from the markers. The `thread/turns/list` response is validated at the boundary.
- Codex Subagent threads are filtered at discovery.
- Claude `waitingFor` gets an exhaustive mapping and a count of unknown values. Issue #36213 is handled.
- Ticket 2 becomes small or disappears. Codex live status already ships. The Claude state event cannot tell a permission from a question, so `canUseTool` stays.
- Ticket 1 moves the Subagent input, or keeps the per-file watchers until ticket 3.
- Tests: the mock CLI writes recorded pid file shapes.

Open for the owner:

- ADR-0047. Every route for external status breaks its ban on liveness checks and rollout parsing. Either amend ADR-0047, or use only `claude agents --json` for Claude, which is documented, and accept `unknown` for external Codex status.
- Claude activity. A full `getSessionMessages` costs 200 to 510 ms and up to 711 MB RSS on each change. The other route is an incremental tail of the new lines. That is parsing of our own, but it is cheap.
- The pid file against `claude agents --json` for Claude status.

## Spike results

### Spike 3: Codex Subagents and `thread/turns/list` (details in /tmp/spike-codex-turns.md)

- Subagents can come from the API. The `subAgentActivity` ThreadItem gives `agentThreadId` (the id), the last segment of `agentPath` (the label) and `kind` (the state, the same enum as the decoder). The nickname comes from `thread/read`. Subagent items appear only with `itemsView: "full"`. Gaps: no spawn `collabAgentToolCall` appeared, and `failed` has no source. `thread/list` with `sourceKinds: ["subAgentThreadSpawn"]` took 20 s for 3 rows.
- `thread/turns/list` is stable, not experimental, and works with `experimentalApi: false`.
  - Params: `{threadId, cursor?, limit?, sortDirection? (desc), itemsView? (summary)}`.
  - Response: `{data: Turn[], nextCursor, backwardsCursor}`.
  - `Turn` has `id`, `items`, `itemsView`, `status`, `error`, `startedAt`, `completedAt` and `durationMs`.
- Cost. On a 249 MB rollout, `summary` takes 1 to 70 ms. `full` takes 110 ms at limit 2, and 4 s and 34 MB at limit 50. On a 179 MB rollout, `full` takes 244 ms at limit 2.
- With `limit: 2`, the newest Turn comes first. A new Turn appears with empty items at first.
- A Turn running in another process reports `status: interrupted` with `completedAt: null`, and it flips to `completed` when it ends. A real interruption was not tested. If a real interruption sets `completedAt`, then `interrupted` with `completedAt: null` means "running elsewhere", and the Codex turn-marker scan can go.

### Spike 2: Codex "open elsewhere" and change detection (details in /tmp/spike-codex-open.md)

- Open elsewhere: a non-blocking `flock(LOCK_EX|LOCK_NB)` probe on `~/.codex/thread-writer-locks/<id>.lock`.
  - Each Codex process holds an exclusive flock while it has the thread loaded: during the turn, after `task_complete`, and until it exits.
  - The probe fails while the lock is held, and it succeeds after a kill, while the file stays on disk. A clean `codex exec` exit deletes the lock file.
  - Node has no flock, so the probe runs as a `/usr/bin/perl -e` one-liner: about 8 ms for 17 files, 6 to 25 ms through `execFile`.
  - `lsof` shows no lock mark and takes 65 to 480 ms.
  - "Held" means "loaded in a live process", not "a turn is running". All 16 older locks were held by live app-servers (14 by the ChatGPT app), so they are not stale.
- Change detection: `fs.watch(rolloutFile)` uses kqueue and fired on every Codex append while the file stayed open, within 0 to 15 ms, at one fd per file. `fs.watchFile` at 1 s also fires, 100 to 1000 ms late. Recursive FSEvents on `~/.codex/sessions` fired 0 times during a turn. A watcher on the lock folder sees only create and delete.
- Design: watch only held rollouts with kqueue, add a 1 to 2 s stat as a safety net, and use the recursive watcher for discovery only.
- Neither the TUI nor `codex exec` connects to the shared daemon.
- Correction to reviewer D item 3 and the round 2 decision: the probe for "open elsewhere" is flock, not `lsof`.

### Spike 1: the SDK read in a utilityProcess, against an incremental tail (details in /tmp/spike-utility-process.md)

- `getSessionMessages` runs in an Electron `utilityProcess` in the packaged app (Electron 44.2.0, arm64, from inside `app.asar`). It needs one build entry in `apps/desktop/scripts/vite-targets.mts`. Vite bundles the SDK into the worker, so `asarUnpack` and forge need no change.
- Measured on the 238 MB transcript:

  | Where | Wall | Main loop lag | Main RSS | Reader peak RSS |
  |---|---|---|---|---|
  | In main | 361-410 ms | 14-17 ms | +575 MB, never returned | the same process |
  | Worker, summary only | 452-518 ms (65-90 ms is the fork) | 3-4 ms | +4 MB | 703-708 MB |
  | Worker, all messages | 469-538 ms | 3-5 ms | +32 MB | 703-708 MB |

- On the 65 MB file: 155 to 190 ms and +200 MB in main, or 257 to 267 ms and a 330 MB worker peak. Sending all messages over IPC costs 6.8 to 24 MB, so the worker sends a summary.
- An incremental tail of a 64 KB append on the 238 MB file takes 0.1 to 0.3 ms and finds the same description as the SDK. A cold start scans back in growing windows and carries a partial last line.
- The SDK reads `CLAUDE_CONFIG_DIR` on every call, memoised by its value, so a test passes the dir in.
- Recommendation: an incremental tail for the Claude activity line. A full read, when it is needed, runs in the utilityProcess and sends a summary, and the worker is recycled.

## Where the spikes leave the plan

- Codex parses nothing of ours, if a real interruption sets `completedAt`:
  - "Open elsewhere" comes from a flock probe.
  - Change detection comes from kqueue `fs.watch` on held rollouts, with a 1 to 2 s stat as a net.
  - Status comes from `thread/turns/list` (`interrupted` with `completedAt: null` means running).
  - Activity and Subagents come from `thread/turns/list` full.
- Claude: status comes from `claude agents --json` or the pid file. The activity line comes from an incremental tail, a small parser of our own, at 0.2 ms against 400 ms and 700 MB. Feed history uses `getSessionMessages` in a utilityProcess.
- ADR-0047 needs an amendment either way: a flock probe and the pid file are liveness checks.

## Appendix: blind verdicts (Opus, kept as reported)

Two reviewers got a neutral brief (`/tmp/argo-design-brief.md`) with no recommendation, no earlier review and no repo access. Each found its own comparable apps.

### Reviewer A: adopt with changes (medium confidence)

Apps: Claude agent view / `claude agents --json`, henriquegpb/codestatus (hooks over a Unix socket, process scan only for discovery and death), gmr/claude-status (plugin hooks write status files), usedhonda/cc-status-bar (Claude hooks, Codex pgrep plus hooks), sotthang/so-agentbar (FSEvents, byte-offset tail, 30 s poll, tool_use with no change = approval, 5 min = idle), d-kimuson/claude-code-viewer (one recursive watch, 100 ms debounce, full re-read over SSE), jazzyalex/agent-sessions (indexed history).

- Stronger: incremental tail, per-Session queue, honest `unknown`. The Feed pattern matches claude-code-viewer.
- Weaker: every peer with reliable status uses hooks. Claude documents `PermissionRequest`, `Notification` (`permission_prompt`, `idle_prompt`, `elicitation_dialog`) and `Stop` for CLI, IDE and Desktop. Codex documents `PermissionRequest`, `Stop`, `Interrupt`, on by default.
- Weaker: `claude agents --json` lists background sessions only; interactive terminal and IDE sessions do not appear. The design really rests on undocumented `sessions/<pid>.json`.
- Unusual: no peer uses the flock probe or the interrupted plus null `completedAt` rule. Reviewer says the app-server docs mark `thread/turns/list` experimental (our measurement: it works with `experimentalApi:false`).
- Coverage gap: so-agentbar also watches Xcode CodingAssistant and Cowork project folders.
- Risks: version skew between SDK/app-server and a newer CLI's format; untested Codex inference; 700 MB full re-read per change; Codex cannot show permission or asking without hooks, which breaks parity; the 5 min quiet limit misreads long commands and waiting approvals.
- Changes: (1) opt-in hooks as the main external status source, tail and registry as fallback, `unknown` with no data, consent because Codex trusts hooks by hash; (2) correct the `claude agents` claim and validate `<pid>.json` at the boundary; (3) Codex status from rollout turn markers plus the lock, interrupted rule unproven; (4) Feed live updates from the incremental tail, full SDK read only for first load and rebuild; (5) add Xcode and Cowork folders; (6) amend ADR-0047 to cover hooks and parsing.

### Reviewer B: adopt with changes (medium-high confidence)

Apps: minchenlee/c9watch (process scan every 2 s mapped through `~/.claude/sessions/<pid>.json`, status from last JSONL entries plus 20 to 30 s windows; Codex tails appended rollout bytes for `task_started`/`task_complete`/`turn_aborted`, no liveness check), tombelieber/claude-view (watcher plus hooks), bruceyxli/claude-code-monitor and engels74/claude-island (global hooks, exact status, answer permissions from the app), Cocoanetics/CodexMonitor (mtime), PixelPaw-Labs/codex-trace and jazzyalex/agent-sessions (tail readers).

- Against: `claude agents --json` omits interactive sessions. Two readers per vendor pays both costs (700 MB SDK peak, 110 to 244 ms `thread/turns/list` per change vs 0.3 ms tail). Codex status rests on undocumented behaviour and a perl helper. No hooks.
- For: matches the field (c9watch is nearly identical), good measurements, removes about 6,300 watchers, honest `unknown`, no vendor API exists.
- Codex source (`thread_processor.rs`) rewrites InProgress to Interrupted for unloaded threads, and a crashed writer looks the same, so the lock probe is what tells them apart.
- Changes: (1) drop `claude agents --json`; (2) Session status and activity from a bounded tail for both vendors, Codex via turn markers, keep the flock probe; (3) app-server and SDK only while a Feed is open, debounced; (4) optional hooks for both vendors as the exact source for running, permission and asking, heuristics as fallback.
- ADR-0047 must change under any version.

### Where both agree

Both say adopt with changes, drop `claude agents --json` in favour of the pid file, add opt-in hooks as the exact status source with the tail as fallback, take Codex Session status from turn markers plus the lock rather than the interrupted rule, and amend ADR-0047. They differ on the Feed: A wants live updates from the tail, B keeps the APIs but only while the Feed is open.
