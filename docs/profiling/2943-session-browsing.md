# Session browsing on the final design, #2943

This repeats the #2934 workload ([baseline](2934-session-list-baseline.md)) on source
`01a43ebdcc7f291a45b89300df965a20ec0d5fbd`. The machine is the same: Apple M4 Pro, 48 GB, macOS
26.5.1, Node 24.21.0, Electron 44.2.0, a 1,440 by 860 pixel window. The run used the Vite build
and did not clear the operating system file cache. Raw output of run 2 is in
[2943-session-browsing.json](2943-session-browsing.json).

The corpus is synthetic and the same size as #2934: 600 saved Sessions, 120 archived, 120 added
Claude files, 40 added Codex threads, and one 12,001,817 byte Claude transcript. The Codex mock
answers from its app-server state file, so the 40 added Codex threads live there. The append step
adds one thread. `claude agents --json` prints the recorded vendor
output. Every config folder is a throwaway one.

```sh
rtk bun run --cwd apps/desktop build:vite
rtk bun run --cwd apps/desktop measure:session-list --json=/tmp/session-list.json
```

## What the probe records

The probe runs in Electron main. The driver reads it before and after each step. It records:

- sync and async reads of corpus files, with their bytes;
- each corpus file opened, with the bytes read, through `fs`, `fs.promises`, and file handles;
- file watchers started and still active;
- main event-loop delay;
- each `execFile` child process, with its time;
- each SQLite statement and `COMMIT`, with its time, inside the running app;
- tRPC messages and bytes by path, and the open subscriptions, so the Feed reader count is a
  runtime count;
- main RSS, and the working set of each Electron process, main included;
- renderer frames, long tasks, and heap.

The last step waits 10 s with no input, so the poll is the only work.

## Results, three runs

| Measure | #2934 baseline | #2943, runs 1 / 2 / 3 |
| --- | --- | --- |
| Ready list | 1,273.89 ms | 1,022 / 798 / 884 ms |
| Startup main delay, p95 / max | 212.34 / 246.28 ms | 191 / 284, 180 / 183, 191 / 226 ms |
| Startup sync transcript reads | 58 reads, 162,748 bytes | 0 |
| Startup async transcript bytes | 826,652 | 820,789 |
| Startup transcript files opened | not measured | 133 |
| Large transcript read at startup | not split | 131,072 bytes, not the whole file |
| Active file watchers | 195 to 375 | 0 (0 started) |
| Down scroll, main delay max | 263.59 ms | 23.4 / 22.3 / 40.6 ms |
| Down scroll, transcript bytes read | 1,509,284 | 0 |
| Down scroll, list messages | 212, 363,080 bytes | 7, 99,223 bytes (run 3: 3, 42,516) |
| Search, list messages | 31, 41,723 bytes | 1, 536 bytes |
| Archive, list messages | 119, 92,225 bytes | 1, 14,165 bytes |
| Append, transcript bytes read | 2,642,729 | 0 |
| Open Feed subscriptions while browsing | 30 to 120 readers (source-derived) | 0 |
| Open Feed subscriptions after Feed open and six selections | not measured | 1 |
| Large Feed open, Feed message | 10,757,282 bytes | 10,833,786 bytes |
| Large Feed open, renderer longest task | 1,749 ms | 1,809 / 1,779 / 1,796 ms |
| Large Feed open, main delay max | 250.09 ms | 148.6 / 141.0 / 142.7 ms |
| Idle 10 s, main delay max | not measured | 36.8 / 23.7 / 23.0 ms |
| Main RSS, startup to end | 313 to 382 MB | 241 to 325 MB |
| Renderer working set, startup to end | 313 to 832 MB | 303 to 672 MB |

## SQL

In the running app, the longest Session List query took 1.31 to 1.39 ms and the longest `COMMIT`
took 0.50 ms. The isolated #2934 statements, 20 warm runs each (run 2):

| Statement | Median ms | Max ms |
| --- | ---: | ---: |
| Browse, first 30 | 0.3658 | 0.4865 |
| Search `Needle` | 0.2287 | 0.2672 |
| Search `Session` | 0.3815 | 0.4667 |
| Count | 0.0886 | 0.1171 |
| Archive | 0.1553 | 0.2170 |
| One-row `COMMIT` | 0.0543 | 0.3792 |

## History reads

Listing, search, Archive, scrolling, append, and the poll read no transcript bytes. Startup
discovery opens each Claude file once and reads 820,789 bytes in total. The SDK reads the head and
tail of a file, so the 12 MB file gives 131,072 bytes.

The selected Feed is the only whole-history read: 12,001,817 bytes when the large Session opens.
The six rapid selections opened archived rows with no transcript file, so they read nothing. The
Feed reader count stayed at one through those switches.

Uncertain-command recovery runs once at startup. The fresh store holds no uncertain command, so it
read nothing.

## Poll

Every 2 s the poll runs `claude agents --json`. In the app the mock took 156 to 172 ms on average
per call. The real `claude` 2.1.287 takes 120 to 140 ms and peaks at 139 MB per call. That is a separate
hand measurement, outside the driver, from nine runs of:

```sh
/usr/bin/time -l env CLAUDE_CONFIG_DIR="$(mktemp -d)" claude agents --json
```
 The Codex poll reads the lock folder and only runs `perl` when lock
files exist; this workload has none.

No utilityProcess reads the Claude Feed. The only utility process is the network service, at 48
to 49 MB. Electron main reads the Claude Feed itself.

## Stalls

- Large Feed open: main stalls for 141 to 149 ms and the renderer for 1.8 s. Main reads the 12 MB
  file, projects it, and sends one 10.8 MB message. The probe cannot split the main delay between
  those steps. The large selected Feed is not fast. Tracked in #3136.
- Startup: main delay reaches 183 to 284 ms before the list is ready. This includes module load,
  discovery, and the first poll; the probe cannot split it.
- After startup, sync sends one `thread/read` for each of about 300 saved Codex Sessions that
  `thread/list` does not return. Each request spawns `codex --version` first: 274 to 299 spawns in
  1.1 s. Main delay stays under 41 ms, so this is not a main stall. Tracked in #3137.

## Limits

One machine and a synthetic corpus. Native SDK reads that bypass Node `fs` are not counted. The
event-loop histogram samples every 20 ms. IPC bytes are `JSON.stringify` sizes, not transport
cost.
