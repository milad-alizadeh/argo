# Session List baseline for issue 2934

This baseline measures the current Session List before the changes proposed in issue 2933. The source revision is `256cda4486342db56cae8c9cbe5ddb97b55d4f2d`. The run used the Vite build on macOS 26.5.1 (25F80), an Apple M4 Pro, 48 GB of memory, Node 24.21.0, and Electron 44.2.0. The full machine output and each raw sample are in [2934-session-list-baseline.json](2934-session-list-baseline.json).

## Workload

The driver creates a new temporary application data folder for each run. It seeds 600 saved Sessions, archives 120, and adds 120 small Claude files and 40 small Codex files to the recorded fixture files. It adds one 12,001,817 byte Claude transcript with 2,145 turns. The vendor fixture files and the added files use the mock Claude and Codex backends. The driver writes to both Harness file trees during the run. It deletes the temporary tree at the end.

Run the baseline from the ticket worktree:

```sh
rtk bun install --frozen-lockfile
rtk bun run --cwd apps/desktop build:vite
rtk bun run --cwd apps/desktop measure:session-list --json=/tmp/session-list-baseline.json
```

The driver builds a measurement probe and prepends it to the ignored `.vite/build/main.js` entry. It restores that entry after the run. Keep other app processes out of this worktree while the driver runs. The source files and packaged application stay unchanged.

The driver starts a fresh Electron process with a fresh SQLite store. It sets the window content to 1,440 by 860 pixels. It records startup before showing the window. It then shows the window and performs these steps in order:

1. Scroll down and up with eight 1,100 pixel wheel events in each direction.
2. Search for the large transcript, open it, wait for its first Feed row, and clear the search.
3. Search for `Needle` and wait for one matching Session.
4. Open the Archive filter and wait for archived rows.
5. Append about 1 MB to the Claude transcript and one recorded line to a Codex file.
6. Select six visible archived Sessions in quick succession.

The startup is cold at the process and application data level. The run does not clear the operating system file cache. SQLite query timings come after the gestures and include 20 warm runs of each statement. The driver adds fixed waits of 300 ms after each gesture, 750 ms in Archive and append actions, and 80 ms between wheel events. The elapsed times include those waits.

## Methods and results

The probe wraps Node filesystem calls in Electron main. It counts reads under the temporary Claude and Codex roots, including the Claude symlink path. It also counts `fs.watch` starts and active watchers. `monitorEventLoopDelay` records main process delay at 20 ms resolution. The renderer records animation frame intervals and long tasks through browser performance APIs. CDP reports renderer heap use. Electron process metrics report the renderer working set, and `process.memoryUsage()` reports main RSS. IPC bytes are the UTF-8 size of `JSON.stringify` on tRPC requests and results. These byte counts describe serialized payloads, not transport overhead.

The first list page owns 30 full-history readers by the current `sessionListProcedure` and `SessionFeedReaders` source path. The four loaded pages own 120; the search page owns one. The selected Feed can add a reader when its Session is outside the loaded list. These are source-derived counts from page length and the one-reader-per-row call path, not a direct runtime counter. The active watcher count provides a separate runtime observation: 195 after startup, 375 after four pages, 197 during search with the large Feed selected, and 375 after the large Feed closes. The run started 1,333 watchers in total as subscriptions changed.

At startup, the driver reached a ready Session List in 1,273.89 ms. Main made 58 synchronous file reads totaling 162,748 bytes, 62 synchronous directory reads, 29 synchronous file status calls, and 149 asynchronous file reads totaling 826,652 bytes. Main event-loop delay reached 246.28 ms, with a 212.34 ms p95. Main RSS was 313 MB, and the renderer working set was 313 MB.

| Step | Elapsed ms | Main delay p95 / max ms | Renderer frame p95 / max ms | Frames over 33 ms | Main RSS MB | Renderer working set MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Down scroll | 1,355.42 | 198.44 / 263.59 | 18.5 / 83.5 | 2 | 336 | 405 |
| Up scroll | 1,027.26 | 21.64 / 22.23 | 18.3 / 18.4 | 0 | 337 | 414 |
| Find and open large Feed | 2,784.92 | 40.67 / 250.09 | 50 / 1,749.9 | 4 | 360 | 745 |
| Search | 412.17 | 22.13 / 26.2 | 16.8 / 18.3 | 0 | 362 | 747 |
| Archive | 1,439.87 | 22.18 / 151.13 | 18.3 / 18.6 | 0 | 367 | 784 |
| Claude and Codex append | 1,060.67 | 22.18 / 94.57 | 18.2 / 18.6 | 0 | 381 | 786 |
| Six rapid selections | 613.36 | 25.95 / 27.98 | 50 / 51 | 4 | 382 | 832 |

The large Feed step delivered one `sessionFeed` message of 10,757,282 bytes. It also produced two renderer long tasks. The longest took 1,749 ms. Renderer heap use rose from 43 MB after up scroll to 132 MB after the large Feed step, then reached 174 MB after the final selection. This one run shows retained memory at the end of the sequence. It does not establish a leak.

Down scroll performed 704 synchronous file reads totaling 1,509,284 bytes, 540 directory reads, and 437 file status calls. Five `sessionList` requests caused 212 list messages totaling 363,080 bytes. Search sent 31 list messages totaling 41,723 bytes. Archive sent 119 list messages totaling 92,225 bytes and one `sessionArchiveList` reply of 12,449 bytes. The append step read 2,642,729 bytes synchronously. Rapid selection sent six `sessionFeed` subscriptions and received 12 Feed messages totaling 4,833 bytes. The raw file records all IPC paths and message sizes.

## SQLite plans and scans

The driver runs list statements with the current selected fields, join, filters, and order. It uses `EXPLAIN QUERY PLAN` and the local SQLite CLI's `.scanstats on`. The archive route performs an archive ID scan and a separate Session lookup. The `archive rows` query models that second lookup by ID. These are isolated database timings, not end-to-end tRPC timings.

| Statement | Median of 20 runs, ms | Actual scan statistics |
| --- | ---: | --- |
| Browse, first 30 | 0.2269 | Scanned 721 Session rows, tested 721 archive IDs, sorted 601 active rows. |
| Search `Needle` | 0.2148 | Scanned 721 Session rows, sorted one matching row. |
| Count active | 0.1003 | Scanned 721 Session rows and tested 721 archive IDs. |
| Archive IDs | 0.0212 | Scanned 120 archive rows. |
| Archive Session rows | 0.0584 | Used the Session primary key to fetch 120 rows. |

Browse, search, and count report `SCAN session` in their plans. Browse and search use a temporary B-tree for ordering. The archive ID scan reports `SCAN session_archive`; the row lookup reports a primary-key search. A separate 20-run transaction updated one Session row. Its `COMMIT` took 0.0251 ms at minimum, 0.031 ms at median, and 0.0865 ms at maximum. This measures a small SQLite commit, not the full discovery transaction.

## What the run supports

The largest visible stall was the large Feed open. Its 1,749 ms renderer task coincided with a 10.76 MB Feed message, so Feed transfer, projection, and rendering are plausible contributors. This probe cannot divide that task among them. Down scroll also caused main process delays while filesystem reads and directory scans grew with the loaded list. The isolated SQL statements took less than 0.23 ms at the median, so they do not explain those observed stalls at this corpus size. Discovery and list-owned Feed reads both use filesystem work during this sequence; this probe cannot assign each filesystem call to one of those owners.

The probe counts Node filesystem calls in Electron main. Native calls inside the Claude SDK or Codex app server can bypass it. The measured full-history reader numbers come from the source path rather than a live reader registry. Startup frames were not recorded because the proof window starts hidden. Frames after startup can change if another window covers the app. The event-loop histogram observes 20 ms intervals, so it does not report shorter tasks. IPC payload size does not include serialization or copying time. These limits prevent a precise split among Feed, discovery, SQL, IPC, and rendering.

## Comparison procedure

Use the same machine, viewport, Vite build mode, and commands for a later cutover. Run the driver three times with separate JSON outputs. Compare the best run from each revision for startup, each step, event-loop delay, frames, IPC bytes, and memory, as `docs/agents/profiling.md` directs. Compare the query plan and scan counts separately. Record the new source revision and any changed corpus, hardware, cache state, or tool version. No absolute latency target was agreed for issue 2933.
