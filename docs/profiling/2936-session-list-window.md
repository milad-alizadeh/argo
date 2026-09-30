# Session List window for issue 2936

This run measures the bounded Session List window from issue 2936 against the baseline in [2934-session-list-baseline.md](2934-session-list-baseline.md). It uses the same machine, viewport, Vite build mode, corpus, and gesture sequence: macOS 26.5.1, an Apple M4 Pro, 48 GB of memory, Node 24.21.0, and Electron 44.2.0. The worktree was based on `7402b009052f28e624cc8f288726cfd2276ab556` with the issue 2936 changes on top. The best of three runs is in [2936-session-list-window.json](2936-session-list-window.json).

## What changed in the workload

The driver seeds `list_order_at` together with `activity_at`, because the list now orders by the list-order clock. The clock is a stored Session column that moves only on discovery and on Turn transitions. The driver reads `data-offset` and `data-retained` in place of the page count. Its SQL statements are the new keyset seeks. A keyset seek reads the rows after or before one `(list_order_at, argo_id)` key. The browse statement reads 60 rows after a key in the middle of the list, which is the server maximum for one side. The earlier statement reads 30 rows before that key. The renderer asks for 20 rows before its first visible row and 40 after it.

The driver arms its IPC counter after the list subscribes. It therefore counts every `sessionListWindow` read, but it misses `sessionListChanges` messages on a subscription that started before arming. The scroll steps show reads only for that reason.

## Feed readers and retained rows

The list holds one temporary Feed reader for each retained row of an attached view. These counts come from `data-retained` and the one-reader-per-row path in `SessionListFeedObservers`. They are not a live reader registry.

| Point in the run | Baseline readers | Window readers |
| --- | ---: | ---: |
| Startup | 30 | 40 |
| After down scroll | 120 | 60 |
| After up scroll | 120 | 54 |
| Search with one match | 1 | 1 |
| After the search clears | 120 | 40 |

A view never holds more than 60 readers. The selected Feed keeps its own reader when the list releases its row. The ticket screen reads the first window with no change listener attached, so it holds no list readers.

The active watcher count agrees with those numbers. It was 215 after startup (baseline 195), 213 after down scroll (baseline 375), and 215 at the end (baseline 375). The run started 743 watchers in total (baseline 1,333).

## Startup

The ready Session List took 946.61 ms (baseline 1,273.89 ms). Main made 78 synchronous file reads totaling 218,868 bytes (baseline 58 and 162,748) and 159 asynchronous reads totaling 882,132 bytes (baseline 149 and 826,652). The increase is the ten extra first-window readers. Main event-loop delay reached 244.84 ms with a 211.03 ms p95 (baseline 246.28 and 212.34). Main RSS was 314 MB and the renderer working set was 308 MB (baseline 313 and 313).

## Gestures

| Step | Elapsed ms | Main delay p95 / max ms | Frame p95 / max ms | Frames over 33 ms | Main RSS MB | Renderer working set MB | Renderer heap MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Down scroll | 1,131.43 (1,355.42) | 81.07 / 101.12 (198.44 / 263.59) | 18.5 / 18.6 (18.5 / 83.5) | 0 (2) | 339 (336) | 348 (405) | 30 (47) |
| Up scroll | 1,087.35 (1,027.26) | 40.73 / 41.91 (21.64 / 22.23) | 17.9 / 18.6 (18.3 / 18.4) | 0 (0) | 345 (337) | 391 (414) | 27 (43) |
| Find and open large Feed | 2,536.70 (2,784.92) | 22.2 / 107.09 (40.67 / 250.09) | 50.2 / 1,831.6 (50 / 1,749.9) | 5 (4) | 377 (360) | 736 (745) | 118 (132) |
| Search | 329.94 (412.17) | 22.09 / 22.13 (22.13 / 26.2) | 18.5 / 18.6 (16.8 / 18.3) | 0 (0) | 377 (362) | 736 (747) | 120 (142) |
| Archive | 1,298.96 (1,439.87) | 22.15 / 22.17 (22.18 / 151.13) | 18.3 / 32.5 (18.3 / 18.6) | 0 (0) | 377 (367) | 751 (784) | 124 (151) |
| Claude and Codex append | 1,057.05 (1,060.67) | 22.17 / 161.35 (22.18 / 94.57) | 17.9 / 18.7 (18.2 / 18.6) | 0 (0) | 359 (381) | 753 (786) | 128 (157) |
| Six rapid selections | 615.40 (613.36) | 22.2 / 23.59 (25.95 / 27.98) | 31.9 / 34.1 (50 / 51) | 1 (4) | 359 (382) | 763 (832) | 143 (174) |

Baseline values are in parentheses. The elapsed times include the fixed waits of the driver.

Down scroll made 9 window reads totaling 371,294 bytes (baseline 212 list messages totaling 363,080 bytes). It made 288 synchronous file reads totaling 1,512,260 bytes, 224 directory reads, and 205 file status calls (baseline 704, 1,509,284, 540, and 437). The main delay fell because fewer readers start at the same time.

Up scroll costs more than before. The baseline kept every loaded page, so up scroll read nothing. The window evicts rows, so up scroll made 21 window reads totaling 881,668 bytes and 273 synchronous file reads totaling 516,516 bytes. The readers for the rows that come back read their history again. The main delay p95 rose from 21.64 ms to 40.73 ms.

Search made one window read of 736 bytes (baseline 31 messages totaling 41,723 bytes) and no synchronous file reads (baseline 87). Archive made one window read of 29,637 bytes (baseline 119 messages totaling 92,225 bytes). The Claude and Codex append made two window reads totaling 59,340 bytes (baseline one message of 85,631 bytes).

While the large Feed opened, its Turn streamed and the list received 163 invalidations totaling 10,432 bytes. An invalidation is a message with no rows that tells the view to read again. The view made 5 window reads totaling 57,739 bytes for them (baseline 152 messages totaling 208,334 bytes). The reader collects changes for 50 ms before one read. Without that delay, the Feed readers that a window move opens each publish activity once, and each publication read the window again. In an earlier run with a 90-row window and no delay, one up scroll made 202 reads totaling 13,184,592 bytes.

## Remaining large-transcript cost

The large Feed is unchanged. Opening the 12,001,817 byte transcript delivered one `sessionFeed` message of 10,757,282 bytes and two renderer long tasks. The longest took 1,803 ms (baseline 1,749 ms). The selected Feed reads its whole history, and this issue does not change that. Each list-owned reader also reads the whole history of its Session, so a window move still starts that work for every row it adds.

## SQLite plans and scans

| Statement | Median of 20 runs, ms | Baseline median, ms | Scan statistics |
| --- | ---: | ---: | --- |
| Browse, 60 rows after a key | 0.0635 | 0.2269 (first 30) | Searched `session_list_order` for 60 Session rows and tested 60 archive IDs. |
| Earlier, 30 rows before a key | 0.0343 | none | Searched `session_list_order` for 31 Session rows and tested 30 archive IDs. |
| Search `Needle` | 0.1711 | 0.2148 | Walked 721 Session rows in `session_list_order` order and found one match. |
| Count active | 0.0814 | 0.1003 | Walked 721 Session rows in the covering index and tested 721 archive IDs. |
| Archive IDs | 0.0193 | 0.0212 | Scanned 120 archive rows. |
| Archive Session rows | 0.0979 | 0.0584 | Walked 721 rows of the covering index. |

Browse, earlier, and search use `session_list_order` and have no temporary B-tree for ordering. A browse read touches only the rows it returns. Search still walks every Session of the Project, because it filters on title and preview text. Issue 2937 owns search. The archive row lookup now picks the new index over the primary key. That lookup belongs to issue 2937 too. A 20-run update of one Session row took 0.0425 ms at median for its `COMMIT` (baseline 0.031 ms).

Each window read also runs two counts: the active total and the count of rows before the first returned row. Both walk the index, so their cost grows with the Project and with the scroll depth. An `index` or `end` anchor reads one key at an `OFFSET` in the index before it seeks. The list uses an `index` anchor only when the visible rows are outside the retained window. A `key` anchor does not use `OFFSET`. Issue 2938 and later issues own a refresh that keeps the counts.

## Limits

The limits of the baseline probe apply here too. The reader counts come from the source path. The event-loop histogram has a 20 ms resolution. IPC byte counts describe serialized payloads only. The scroll steps miss the invalidations of a subscription that started before the counter was armed.
