# Search scan and Archive page, #2937

One run of the #2934 workload (`docs/profiling/2934-session-list-baseline.md`) on the #2937
branch, based on `7aa56a23e`. Same machine as the baseline: Apple M4 Pro, 48 GB, macOS 26.5.1,
Node 24.21.0, Electron 44.2.0. Same corpus: 600 saved Sessions, 120 archived. The operating
system file cache was not cleared.

Run it with `bun run --cwd apps/desktop build:vite`, then
`bun run --cwd apps/desktop measure:session-list --json=/tmp/session-list.json`. The driver's SQL
list now holds the queries this branch runs.

## SQL

Each query ran 20 times on a warm connection. Rows come from `sqlite3 .scanstats on`.

| Query | Median ms | Min / max ms | Rows read |
| --- | --- | --- | --- |
| Search scan, `Needle` (1 match) | 0.1517 | 0.148 / 0.1903 | 721 Session rows through `session_list_order` |
| Search scan, `Session` (480 matches) | 0.2604 | 0.2548 / 0.3066 | 721 Session rows, 600 Archive probes |
| Search window over 480 matched IDs | 0.1853 | 0.1839 / 0.6275 | 480 primary-key reads, then a sort |
| Browse window | 0.0393 | 0.0386 / 0.0566 | 34 rows through `session_list_order` |
| Count | 0.0847 | 0.0793 / 0.1079 | 721 index entries |
| Archive page (21 rows) | 0.1019 | 0.1009 / 0.1498 | 721 Session rows, 120 Archive matches |
| Archive restore by ID | 0.0037 | 0.0034 / 0.0214 | 1 row by primary key |

The search scan reads every Session row of the Project. No index was added; `instr` on
lowercased text cannot use one. The scan now runs when the search opens and after a change that
can add or remove a match. An activity change reads the window from the stored match IDs, which
costs a primary-key read for each match. With 480 matches that costs about as much as the scan.

The Archive page reads one page in SQL. SQLite's planner drives it from the `session_list_order`
index and probes `session_archive` for each row, so it still reads the Project's 721 rows. It
no longer returns 120 rows to JavaScript to sort and slice.

## Workload steps

| Step | Baseline | This branch |
| --- | --- | --- |
| Search `Needle`, elapsed | 412.17 ms | 515.34 ms |
| Search, `sessionList` messages sent | 31 (41,723 bytes) | 1 (749 bytes) |
| Search, main event-loop delay max | 26.2 ms | 22.1 ms |
| Archive, elapsed | 1,439.87 ms | 1,293.31 ms |
| Archive, `sessionList` messages sent | 119 (92,225 bytes) | 1 (73,542 bytes) |
| Archive, main event-loop delay max | 151.13 ms | 22.15 ms |

The driver fills the search field in one step, so the 150 ms settle delay is added to the search
step's elapsed time. The baseline predates #2936, which also changed the list subscription. This
run cannot separate the two changes. One run cannot establish a trend; repeat three times for a
comparison.
