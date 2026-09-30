# Session List query, search and Archive, #2937

One run of the #2934 workload (`docs/profiling/2934-session-list-baseline.md`) on the #2937
branch. Same machine as the baseline: Apple M4 Pro, 48 GB, macOS 26.5.1, Node 24.21.0, Electron
44.2.0. Same corpus: 600 saved Sessions, 120 archived. The operating system file cache was not
cleared.

Run it with `bun run --cwd apps/desktop build:vite`, then
`bun run --cwd apps/desktop measure:session-list --json=/tmp/session-list.json`. The driver's SQL
list holds the queries this branch runs.

## SQL

Each query ran 20 times on a warm connection. Rows come from `sqlite3 .scanstats on`. Every list
query reads one page of 30 rows in `sort_order`, `created_at` order.

| Query | Median ms | Min / max ms | Rows read |
| --- | --- | --- | --- |
| Active page | 0.3009 | 0.2952 / 0.4317 | 721 Session rows, 120 Archive probes, 601 kept |
| Search, `Needle` (1 match) | 0.1526 | 0.1487 / 0.2185 | 721 Session rows, 1 match |
| Search, `Session` (480 matches) | 0.3299 | 0.3172 / 0.3702 | 721 Session rows, 480 matches |
| Count | 0.0805 | 0.0782 / 0.1067 | 721 index entries |
| Archived page | 0.1470 | 0.1403 / 0.2014 | 721 Session rows, 120 Archive matches |
| Changed row by ID | 0.0034 | 0.0032 / 0.0250 | 1 row by primary key |

Each query reads every Session row of the Project and then sorts. No index was added; `instr` on
lowercased text cannot use one, and the Project holds a few thousand Sessions at most. A change
reads only the changed rows by primary key and sends them. The renderer places them in its cached
pages, so a change never reads a list again.

## Workload steps

| Step | Baseline | This branch |
| --- | --- | --- |
| Search `Needle`, elapsed | 412.17 ms | 516.13 ms |
| Search, `sessionList` messages sent | 31 (41,723 bytes) | 1 (786 bytes) |
| Search, main event-loop delay max | 26.2 ms | 25.0 ms |
| Archive, elapsed | 1,439.87 ms | 1,237.92 ms |
| Archive, `sessionList` messages sent | 119 (92,225 bytes) | 1 (21,245 bytes) |
| Archive, main event-loop delay max | 151.13 ms | 23.3 ms |

The driver fills the search field in one step, so the 150 ms settle delay is added to the search
step's elapsed time. The baseline predates #2936, which also changed the list subscription. This
run cannot separate the two changes. One run cannot establish a trend; repeat three times for a
comparison.
