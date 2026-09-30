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
| Active page | 0.3043 | 0.2989 / 0.3808 | 721 Session rows, 120 Archive probes, 601 kept |
| Search, `Needle` (1 match) | 0.1502 | 0.1467 / 0.2157 | 721 Session rows, 1 match |
| Search, `Session` (480 matches) | 0.2963 | 0.2889 / 0.3365 | 721 Session rows, 480 matches |
| Count | 0.0824 | 0.0796 / 0.1102 | 721 index entries |
| Archived page | 0.1573 | 0.1449 / 0.2014 | 721 Session rows, 120 Archive matches |

Each query reads every Session row of the Project and then sorts. No index was added; `instr` on
lowercased text cannot use one, and the Project holds a few thousand Sessions at most. After a
change, the renderer reads its loaded pages again with these same queries.

## Workload steps

| Step | Baseline | This branch |
| --- | --- | --- |
| Search `Needle`, elapsed | 412.17 ms | 518.05 ms |
| Search, `sessionList` messages sent | 31 (41,723 bytes) | 1 (786 bytes) |
| Search, main event-loop delay max | 26.2 ms | 22.4 ms |
| Archive, elapsed | 1,439.87 ms | 1,274.12 ms |
| Archive, `sessionList` messages sent | 119 (92,225 bytes) | 1 (21,245 bytes) |
| Archive, main event-loop delay max | 151.13 ms | 22.8 ms |

In the append step, the history writes announce a change, and the Archive list reads its one
loaded page again: 1 message of 21,245 bytes.

The driver fills the search field in one step, so the 150 ms settle delay is added to the search
step's elapsed time. The baseline predates #2936, which also changed the list subscription. This
run cannot separate the two changes. One run cannot establish a trend; repeat three times for a
comparison.
