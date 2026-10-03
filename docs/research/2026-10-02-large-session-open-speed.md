# How desktop agent apps open a large Session fast, and what Argo should copy

Question: Codex Desktop, the Claude desktop app's Code tab, Conductor and similar apps open a
Session with tens of MB of history almost at once. How, and where does Argo lose time on the
same open?

One researcher read each app's bundle or source, and one traced and timed Argo. No other app was
run or timed; their numbers are constants read from code, or figures their projects published.
Argo's numbers are measured (least of 5 runs, quiet machine, 2026-10-02). Minified-bundle readings
are marked as inferred in the sections below.

## Inventory: what happens between the click and the first message

| App | What is read on open | First page | Older history | Kept between opens | List drawing |
|---|---|---|---|---|---|
| **Codex Desktop** (`/Applications/ChatGPT.app`, com.openai.codex 26.928) | SQLite (`~/.codex/thread_history_1.sqlite`), filled as the thread is written; the rollout file is not read | `thread/resume` with `initialTurnsPage {limit: 5, sortDirection: "desc"}`; items 100 per request, 500-item budget | Pages of 5 turns when the gap comes within 800px; anchor turn held | Conversations in memory; per-turn heights and scroll position | Hand-written turn virtualizer, 280px estimate, overscan 2, `content-visibility: auto` |
| **Claude desktop Code tab** (`/Applications/Claude.app`) | The last 1 MiB of the `.jsonl`, then 5 MiB if too few rows; full load capped at the last 50 MiB | Newest 200 rows, streamed over a MessagePort in chunks of 250 with a yield between | `fetchEarlierTranscript`, `beforeUuid` cursor, 200 rows | Worker keeps parsed rows keyed by mtime/size/inode and reads only appended bytes; renderer keeps rows, heights, anchor | Custom windowing, measured heights, 600px overscan, upward overscan only after 2 frames |
| **Conductor** | Own SQLite `session_messages`, indexed on `(session_id, sent_at)`, plus a `cache.db` with `feed_offset` | Not found (bundle not unpacked) | Not found | `cache.db` | Not found |
| **Vibe Kanban** | Per-turn streams | Paints after 10 entries | Older turns in batches of 50 | Not found | TanStack Virtual, text-length estimates |
| **claude-devtools** | Stream-parsed `.jsonl` | Whole Session | n/a | Built Session cached by `mtime-size`; refresh is one `stat` | Virtualized above 30 items |
| **Crystal** | Own SQLite, one row per streamed line | `LIMIT 5000` (panel path: no limit) | n/a | SQLite | None |
| **opcode** | Whole `.jsonl` in Rust | Whole Session in one IPC reply | n/a | Nothing | TanStack Virtual |
| **Argo** | Claude: whole `.jsonl` via SDK `getSessionMessages`. Codex: every `thread/turns/list` page | **Whole Feed** in one IPC message (5.6 to 23.5 MB on real Sessions) | n/a | **Nothing** (reader dropped, `gcTime: 0`, measure pass redone) | Mounts **every** row hidden to measure, then TanStack Virtual |

Web and editor feeds read in the first pass (VS Code Chat, Zed, OpenCode desktop, Cline) agree
on the list side: mount only visible rows, cache heights, estimate unseen ones (200 to 280px),
anchor the scroll while a row grows. OpenCode desktop also pages history: newest 20, then 200 per
cursor page. Their notes are below.

## Where Argo's time goes

Measured in the real Electron window with mock history (`measure:feed-history`, patched, see
caveats) and on the largest real transcripts on this machine for the main-process steps.

| Step | Code | Cost |
|---|---|---|
| Measure pass: every row mounted hidden, with `react-markdown`, before the virtual list starts | `renderer/feed/scroll/anchored-feed.tsx` `AnchoredFeed` / `MeasureFeedRows` | One long task of 0.8 s at 5 MB, 1.6 s at 10 MB (about 160 ms per MB). Repeats on every re-open; the saved `initialMeasurementsCache` is never read |
| Whole Feed in the first IPC message; tool output uncut, images inline base64 | `domains/sessions/main/api/session-feed.ts`, `feed-images.ts:dataImageUrl` | 5.6 to 23.5 MB (Claude), 11.8 to 17 MB (Codex) |
| Row projection: zod on every item and row (rows twice), stringify and hash per row | `domains/sessions/api/feed/feed-row-entries.ts` `FeedRowProjector.project` | 26 to 116 ms warm, one sync block on main |
| Claude read and parse on main | `harnesses/claude/session/claude-session-history.ts` | 72 to 680 ms warm, 1.2 s first read of a 238 MB file; follows line count |
| Codex read through `codex app-server` | `harnesses/codex/session/codex-turn-pages.ts` | 60 to 190 ms; all pages read before anything shows; 8 s timeout per page |

Click to first row: 1.7 s at 1 MB, 1.8 s at 5 MB, 3.0 s at 10 MB. The real image-heavy
transcripts are likely 2.5 to 4 s (extrapolated, not measured).

## What Argo should change, ranked by measured cost

1. **Stop measuring every row before the first paint.** Mount the virtual list straight away with
   estimated heights, measure rows as they become visible, and correct the scroll from the
   bottom anchor (every app above does this). Read the saved measurements cache on re-open.
   Removes the largest cost: 0.8 to 1.6 s of blocked renderer at 5 to 10 MB.
2. **Send the newest page first, the rest later.** First message: the newest ~200 rows (Claude
   desktop) or 5 turns (Codex Desktop); older rows by cursor as the user scrolls up, with the
   anchor held. For Codex, Argo already speaks to `codex app-server`, so it can ask for the newest
   page the way Codex Desktop does instead of reading every page first.
3. **Read only the tail of a Claude transcript for first paint.** The Claude desktop app reads the
   last 1 MiB, widens to 5 MiB only when needed, and caps a full load at 50 MiB. Argo parses the
   whole file through the SDK, including lines outside the chain.
4. **Keep the parsed Session between opens.** Key it by mtime/size (claude-devtools, Claude
   desktop) and read only appended bytes on change. Keep the renderer's rows and heights for
   recently opened Sessions instead of `gcTime: 0`. Reopening then costs one `stat`.
5. **Keep big content out of the Feed message.** Send tool output as head and tail with a
   "show more" fetch, and send images as references the renderer loads on demand, not base64.
6. **Move parsing and projection off the main process** (Claude desktop runs it in a utility
   process and streams rows in chunks with a yield between). Lower priority: 0.1 to 0.8 s today.

An own SQLite store of messages (Codex, Conductor, Crystal) is the end state of 3 and 4, but 1 and
2 alone remove most of the measured time.

## Caveats

- `bun run measure:feed-history` fails at this commit with `EEXIST` because
  `createMockSessionHarnessBackend().start()` already creates the folders the tool creates; the
  timings above came from a patched copy outside the repo. `--sizes` accepts only 1, 5 and 10.
- `measure:session-open` in `apps/desktop/package.json` points at
  `tools/sessions/open-session-cost.ts`, which does not exist.
- Codex Desktop: not proved which flag branch a plain local thread takes. Claude desktop: the
  utility-process path sits behind a remote flag whose default is unknown.
- The note `2026-09-14-feed-stall-freeze-mechanism.md` describes `src/core/sessions/*`, which no
  longer exists; the current reader is `domains/sessions/main/feed/feed-reader.ts`.

## Per-app notes

Each section is one researcher's full notes, with citations. Scratch scripts they mention lived in
a temporary folder and are not in the repo.

### Where the time goes when Argo Desktop opens a large existing Session

Measured on an Apple M-series Mac, Node 24.21 / Bun 1.3.14, Electron Vite build, 2026-10-02. Paths are under `apps/desktop/src`. Scratch scripts and raw logs are in this folder (`claude-open.mts`, `codex-open.mts`, `*-runs.log`, `feed-history.log`).

Note: `src/core/sessions/*` named in the old research note no longer exists. The code now lives in `domains/sessions/{api,main,renderer}` and `harnesses/<harness>/session`. The 2026-09-14 stall note (the `stableChain` loop) describes a code path that was replaced by `FeedReader` in `domains/sessions/main/feed/feed-reader.ts`. Nothing in the current path loops on file changes.

#### Table: the path from click to first Feed rows

Times for "main" steps are least of 5 warm in-process runs from my scratch scripts, with nothing else running. "First run" is the first of those runs, which is closer to what a user sees on a click. Renderer times come from the repo's own `measure:feed-history` tool (mock Claude history, real Electron window, driven over CDP), because I cannot run the real renderer on real transcripts without taking the app over.

| # | Step | file:function | Strategy | Measured | Notes |
|---|------|---------------|----------|----------|-------|
| 1 | Click selects a Session, renderer subscribes | `renderer/feed/use-feed-reading.ts:useFeedSubscription` calls `trpcClient.sessionFeed.subscribe` | Renderer, async. Query cache has `gcTime: 0`, so nothing is kept after a Session closes. | not measurable alone, under 1 ms | One subscription per open Feed. |
| 2 | IPC in, transport | `platform/main/trpc-transport.ts:attachTrpcTransport`, `startSubscription` | `ipcMain.handle` then observable. Main thread. | negligible | Result goes back with `webContents.send` (structured clone). |
| 3 | Reader starts, queue slot | `domains/sessions/main/feed/feed-reader.ts:SessionFeedReaders.observe`, `FeedReader.start/#startRead`; `history-read-limit.ts:HistoryReadLimit.run` | Main thread, async. One reader per chain, shared. 2 read slots. No cache: the reader is stopped when the last observer leaves, so every open re-reads. | under 1 ms | A pending Session (no native id yet) short-circuits in `pending-feed-reading.ts`. |
| 4a | Claude read | `harnesses/claude/session/claude-session-history.ts:readClaudeSessionHistory` calls SDK `getSessionMessages` (SDK 0.3.278) | Main thread (no worker, no utilityProcess). Whole file read into a Buffer, then every line `JSON.parse`d, yielding with `setImmediate` every 512 KB. For files over a size threshold the SDK reads only from the last compact boundary. Async but CPU is on main. | 65 MB / 4,800 lines: 72 ms best, SDK floor `JSON.parse` of all lines 30 ms. 81 MB / 30,707 lines (33 in chain): 496 ms best, 764 ms first run. 238 MB / 27,007 lines: 680 ms best, 1,170 ms first run. | Cost follows line count, not just bytes: the SDK parses lines that are not in the chain. |
| 4b | Codex read | `harnesses/codex/session/codex-session-history.ts:readCodexSessionHistory` via `codex-turn-pages.ts:codexTurnPages` (`thread/turns/list`, 50 turns a page, `itemsView: 'full'`) | Done in the long-lived `codex app-server` child process. Main waits on JSON lines over stdout, parses each page with zod (`turnsPageSchema`, looseObject). Paged, but all pages are read before anything shows. | 98 MB: 60 ms (1 page). 122 MB: 134 ms (1 page). 249 MB: 191 ms (2 pages, slowest page 146 ms). | App-server was already warm. A cold spawn plus handshake was 110 to 230 ms once. Each request has an 8 s timeout (`REQUEST_TIMEOUT_MS`) per page. Then one more `readCodexNickname` request per delegation row, in parallel. |
| 5 | Decode to Feed content | `claude-feed.ts:claudeFeedContent` / `codex-feed.ts:codexFeedContent` | Sync, main. | 0.3 to 3 ms (10 ms first run on the 238 MB file) | Not a cost. |
| 6 | Project to rows | `domains/sessions/api/feed/feed-row-entries.ts:FeedRowProjector.project`, with `live-feed-rows.ts:historyFeedRows`, `tool-groups.ts` | Sync, main. Zod-parses every content item, every row (twice: `sessionFeedRowSchema` then `feedRowSchema`), and `JSON.stringify` plus a hash per row for `revision`. A cache keeps settled rows across live events, but the first open pays everything. | Claude 65 MB (image heavy, 23 MB result): 116 ms best. Claude 238 MB: 26 ms best, 145 ms first run. Codex 98 / 122 / 249 MB: 48 / 67 / 78 ms. | This is one blocking sync call on the main thread. In an earlier contended run it measured 266 to 638 ms for the 65 MB file, so it is sensitive to load. |
| 7 | Build reading and revision | `api/feed/feed-reading.ts:feedReading` | Sync, main. Revision hashes row ids only. | 0.1 to 0.3 ms | Not a cost. |
| 8 | Persist side effects | `feed-reader.ts:#publish` calls `updateSession`, `saveSessionSubagentFacts` | Sync SQLite on main. | small (2943 note: statements 1 to 2 ms) | Not a cost. |
| 9 | IPC payload out | `domains/sessions/main/api/session-feed.ts:sessionFeedProcedures` then `webContents.send` | First message is the whole Feed (`FeedReading`), later ones are deltas (`feedReadingChange`). No limit, no truncation: tool output text is in every tool row's `evidence.source`, and images travel as inline `data:` base64 URLs (`feed-images.ts:dataImageUrl`). | Payload: Claude 65 MB transcript gives 23.5 MB; Claude 238 MB gives 5.6 MB; Codex 98 / 122 / 249 MB give 11.8 / 15.3 / 17.0 MB. `JSON.stringify` 13 to 35 ms; V8 serialize plus deserialize 7 to 49 ms standalone. In-app: 0.9 MB for 1 MB history, 4.5 MB for 5 MB, 9.1 MB for 10 MB, always 3 messages. | Serialization runs on main inside `send`, then again on the renderer. The 2943 profile saw main delay of 141 to 149 ms on a 10.8 MB message. |
| 10 | Renderer applies reading | `use-feed-reading.ts:applyFeedReadingChange`, `queryClient.setQueryData`, `drawnFeed` | Renderer main thread. Structural sharing walks the whole payload. | part of the long task below | Not split out by any probe. |
| 11 | Measure pass: mount every row | `renderer/feed/scroll/anchored-feed.tsx:AnchoredFeed` then `MeasureFeedRows` | Renders EVERY row, hidden (`inert`, `.feed__measurement`), awaits `document.fonts.ready`, then reads `getBoundingClientRect` for each. Only after that does `VirtualFeed` mount. Every row includes `react-markdown` + `remark-gfm` (`content/feed-markdown.tsx`) for assistant prose and thoughts, tool lines, and `<img>` for inline images. `AnchoredFeed` starts with `measurements = null` every mount, so the `initialMeasurementsCache` saved by `use-feed-measurements-cache.ts` is never used to skip this pass. | In-app: 1 MB: open 1,743 ms, long task 202 ms. 5 MB: open 1,794 ms, one long task 826 ms, 2,721 row DOM updates. 10 MB: open 2,965 ms, one long task 1,617 ms, 5,412 row updates. Switching back (same data, warm): 341 / 1,009 / 1,943 ms with long tasks 181 / 824 / 1,607 ms. | About 160 ms of blocked renderer per MB of history, and the same cost again on every re-open. The earlier real-run record in docs/profiling/2943 (12 MB Claude file, 1.8 s longest renderer task, 10.8 MB message) agrees. |
| 12 | Virtual list mounts visible rows | `scroll/feed-viewport.tsx:FeedViewport`, TanStack `useAnchoredVirtualizer` | Virtualized. Only visible rows in the DOM. But the visible rows render a second time (markdown parsed twice for them). | small compared to step 11 | The virtualization exists, but it starts after step 11 has already mounted everything once. |
| 13 | First rows on screen | `anchored-feed.tsx:useInitialFeedPosition` scrolls to the tail | Renderer. | included in "open" above | Open in-app total is 1.7 s (1 MB) to 3.0 s (10 MB) from click to first `[data-feed-row]`. |

#### Real transcripts used (largest on this machine)

| Harness | File | Size | Lines |
|---------|------|------|-------|
| Claude | `~/.claude/projects/-Users-milad-Developer-argo--claude-worktrees-ticket-650-atlas-prototype/b541025d-...jsonl` | 238.6 MB | 27,007 |
| Claude | `~/.claude/projects/-Users-milad-Developer-argo/b6522cce-...jsonl` | 81.7 MB | 30,707 |
| Claude | `~/.claude/projects/-Users-milad-Developer-argo/c2224571-...jsonl` | 65.6 MB | 4,800 |
| Codex | `~/.codex/sessions/2026/09/21/rollout-...01a0c12d-...jsonl` | 249.4 MB | not counted (59 turns) |
| Codex | `~/.codex/sessions/2026/09/18/rollout-...01a0b63a-...jsonl` | 122.0 MB | 13,536 |
| Codex | `~/.codex/sessions/2026/09/16/rollout-...01a0ab09-...jsonl` | 98.6 MB | 5,107 |

Main-process total, warm best-of-5, from click to a ready reading (steps 4 to 7, excluding transfer): Claude 65 MB about 220 ms; Claude 81 MB about 500 ms; Claude 238 MB about 710 ms (first run about 1.3 s); Codex 98 MB about 110 ms; Codex 249 MB about 270 ms.

#### Biggest costs, ranked

1. **The renderer mounts every row before it virtualizes (step 11).** One uninterrupted long task: 0.8 s at 4.5 MB, 1.6 s at 9 MB in the in-app tool, 1.8 s on the real 12 MB file in the 2943 profile. It scales at roughly 160 ms per MB of payload and repeats on every re-open, including a switch back to a Session that was already measured. The saved measurements cache is passed in but never read to skip the pass. Extrapolating at that rate, the 23.5 MB payload of the 65 MB Claude transcript and the 17 MB Codex payload would block the renderer for roughly 2.5 to 4 s. That extrapolation is an estimate, not a measurement: the mock history is text, the real one is image and tool-output heavy.
2. **The first message is the whole Feed, unbounded (step 9).** 0.9 MB per MB of history in the mock, 5 to 23 MB on real transcripts. Tool outputs are not truncated and images are inline base64. It costs serialize time on main plus deserialize and structural sharing in the renderer (steps 9 and 10), and it feeds cost 1 directly.
3. **Row projection on main (step 6).** Zod over every item and row, twice for rows, plus per-row JSON.stringify and hashing. 50 to 120 ms warm on the large real files, up to 640 ms when the machine was busy. It is one sync block, so main cannot answer anything else meanwhile.
4. **Claude file read and parse on main (step 4a).** 70 to 700 ms warm, up to 1.2 s on a first read of the 238 MB file. It yields every 512 KB, so the window stays responsive, but the cost grows with line count, including lines that are not in the chain (81 MB file: 30,707 lines, 33 used, 496 ms).
5. **No caching of any layer.** Main reader is dropped with its last observer, the renderer query cache has `gcTime: 0`, and the measure pass ignores the saved measurements. Every open pays steps 3 to 13 in full.
6. **Codex pagination and the 8 s per page timeout (step 4b).** Fast today (60 to 190 ms), but one page of 50 full turns must answer within 8 s. A very large page could fail the whole Feed (`codexTurnPages` throws rather than stopping short). I did not hit it.

Not a cost: decode to Feed content (under 3 ms), building the reading envelope (0.3 ms), SQLite side effects (about 1 to 2 ms), the tRPC transport itself.

#### How to repeat

- Main-process steps: `rtk bun run <scratch>/claude-open.mts <jsonl> <native-id> <cwd> 5` and `rtk bun run <scratch>/codex-open.mts <rollout.jsonl> 5`, run from `apps/desktop` so the `@/` aliases resolve. They import straight from `src` and touch no tracked file. The Codex script uses the real `createCodexAppServerClient` against your real `~/.codex` (read-only `thread/read` and `thread/turns/list`).
- In-app open, switch, refresh and stream: `bun run measure:feed-history --sizes=1,5,10`. It launches Electron over Playwright CDP with the mock Claude, so it never takes the mouse or keyboard. At this commit it does not run as shipped (see dead ends). I ran a patched copy outside the repo (`measure-feed-history.patched.ts`, bundled to a temp file in the ignored `out/tools/`, deleted afterwards). `--sizes` only accepts 1, 5 and 10; a 40 MB run was silently skipped.
- Existing `package.json` script `measure:session-open` points at `tools/sessions/open-session-cost.ts`, which does not exist.

#### Dead ends and caveats

- `bun run measure:feed-history` fails at this commit with `EEXIST` on `codex-home` (and then on the `claude-config/projects` symlink), because `createMockSessionHarnessBackend().start()` already creates both. I removed the `mkdir`/`symlink` steps in my scratch copy only. This is a bug in the tool, not in the app.
- `measure:session-open` is a dangling script (file missing).
- My first batch of timings ran while another Bun process was running and came out 2 to 5 times slower (for example SDK read 390 ms instead of 72 ms for the 65 MB file, projector 638 ms instead of 116 ms). I discarded them and re-ran with nothing else running. Treat these numbers as machine-load-sensitive; they are least of 5, not medians.
- The in-app tool uses synthetic text history, not my real transcripts. Real Feeds with images and big tool outputs have larger payloads per row but fewer rows, so the per-MB renderer rate may not transfer.
- Warm in-process numbers undercount a real first click: file cache, JIT and module warm-up are already paid. The first-run column (0.76 s and 1.17 s for the SDK on the two big files) is the better guide for a cold click.
- I could not time the Codex rollout parse inside the app-server (it is a separate Rust process); the 60 to 190 ms includes its read, the stdout pipe and Argo's zod page parse together.
- The 2026-09-14 `stableChain` stall (never-settling read on a file still being written) is gone in the current code. I did not re-test a live-written external transcript.
- `git status` showed about 10 modified tracked files under `apps/desktop/src/**/renderer` (atlas-sidebar, project-switcher, app-shell and so on) near the end of my work. I did not touch them; the status was clean at the start, so another process is editing the tree. I made no commits and edited no tracked file. `bun run build:vite` rewrote only ignored `out/`.

### How the Codex desktop app opens a big thread

Sources (all read-only):
- App: `/Applications/ChatGPT.app` (bundle id `com.openai.codex`, version 26.928.31416, Electron, Chromium 154). The Codex desktop app ships under the ChatGPT name. There is no separate Codex.app. Extracted with `npx @electron/asar extract` to `<scratchpad>/codex-desktop`. In the tables, `assets/` means `codex-desktop/webview/assets/` and `build/` means `codex-desktop/.vite/build/`.
- Server: openai/codex shallow clone at `<scratchpad>/codex`, commit cb6da58876afed3ede0ab11084f67dd5394ecb48 (2026-10-02). The app bundles its own `Resources/codex-cli`; I did not check that its version equals this commit, so server claims are "same family, version not matched".
- Local data: `~/.codex/*.sqlite` opened read-only (`sqlite3 -readonly`), schema and counts only.
- Minified names (`rz`, `Pe`, `Oy`...) change every release. The structure is the finding. Minified readings are marked "inferred" in the confidence column where I did not see a plain-text anchor.

#### Table: the open path, click to first messages

| # | Step | Technique | Evidence | Confidence |
|---|---|---|---|---|
| 1 | Client asks for the newest slice only | `thread/resume` is sent with `initialTurnsPage: {limit:5, itemsView:"full", sortDirection:"desc"}`, so the reply carries the 5 newest turns and no full history. In other branches it sends `excludeTurns:true` and lists turns separately. | `assets/app-shared-44edd7bfa69c.js`: `...excludeTurns:P&&!ee&&...,...te&&!E&&!_e?{initialTurnsPage:{limit:5,itemsView:\`full\`,sortDirection:\`desc\`}}:{}`. Protocol doc: `codex-rs/app-server-protocol/src/protocol/v2/thread.rs` (`exclude_turns` comment: "Full-history hydration is deprecated for paginated threads"; `initial_turns_page`) | High that the request exists; medium on which branch a local thread takes (flags `te`,`E`,`_e` are minified) |
| 2 | Turn list runs in parallel with resume | A turn-page load (`uz`) is started before `await a.prepare(...)` for resume, and marks a trace `history_ready`. So the listing does not wait for the resume. | `app-shared-44edd7bfa69c.js`: `Me=je||!ne&&E&&te&&...?uz(e,{...limit:je?I:5...}):null; Me?.then(()=>L?.mark(\`history_ready\`)...); let Ne=await a.prepare(...)` | Medium (inferred from order of statements) |
| 3 | Page size and shape of first page | `thread/turns/list` with `limit` 5 (hard cap `Math.min(limit,5)` in `rz`), `itemsView:"notLoaded"` (turn shells only), `sortDirection:"desc"`. Then per turn `thread/items/list` newest first, 100 items per request, with a total budget of `min(limit,5)*100` = 500 items for the first page. A turn not fully loaded is marked `itemsView:"summary"`. | `app-shared-44edd7bfa69c.js` functions `rz` (`v=Math.min(o??5,5)*100`, `Math.min(100,v,t-c.length)`), `nz` (`limit:c` default 100, halves on "decoded message length too large"). Server limits: `app-server/src/request_processors/thread_processor.rs:5596-5599` (turns default 25 / max 100, items default 25 / max 100) | High for constants, medium for which code path a local thread uses |
| 4 | Turn shells are cheap, items are loaded per turn on demand | Items for older turns are not fetched. A turn that was cut off keeps `itemsPagination` (`olderCursor`, `hasLoadedOldest`, `oldestUserInput`). The opening user message is fetched with a 2-item ascending read so the row can show its prompt. | `app-shared-44edd7bfa69c.js` `rz` (`olderCursor`, `hasLoadedOldest`), `iz` (`nz(...,2,\`asc\`)`) | High |
| 5 | Parallel item reads | In the "progressive" mode, up to 4 turns load items at once and each finished prefix is handed to the UI through `onPartialPage` (first paint before the full page ends). The cloud path uses 5 parallel readers and 500-item pages. | `app-shared-44edd7bfa69c.js`: `k$t` (`Array.from({length:Math.min(4,e.data.length)}`), `uz` (`onPartialPage:d.size===0&&a.cursor==null?...`), `B$t=5`, `V$t=500` | High that it exists; medium that local threads use progressive (it is gated on `je`/bounded history, which looks cloud-oriented) |
| 6 | Server reads an index, not the rollout file | For `history_mode = paginated` threads, `thread/turns/list` and `thread/items/list` are SQL queries on `~/.codex/thread_history_1.sqlite` (`thread_turns`, `thread_items`, indexes on `(thread_id, rollout_ordinal)`). The rollout JSONL is projected into this DB when the thread is written and at shutdown. A single query returns a page by `rollout_ordinal` plus an opaque cursor. | `codex-rs/app-server/src/request_processors/thread_processor.rs` (`thread_turns_list_response_inner` -> `paginated_thread_turns_list_response` -> `thread_store.list_turns`); `codex-rs/thread-store/src/local/thread_history/read.rs`, `segment_paging.rs` (`page_turn_rows`, `page_item_rows`); `thread_history_materialization.rs`; `live_writer.rs:176-190` (materialize on shutdown unless Legacy). Live check: `~/.codex/thread_history_1.sqlite` is 3.3 GB with tables `thread_turns`, `thread_items`, `thread_history_projection_state`; `state_5.sqlite` `threads` has 3124 rows, all `history_mode='paginated'` | High |
| 7 | Old (legacy) threads would be slow | For `history_mode = legacy` the server replays the whole rollout on every call. The code comment says so. | `thread_processor.rs` `thread_turns_list_response_inner`, comment "it still replays the entire rollout on every request" | High. On this machine no legacy rows exist, so I could not time it |
| 8 | Work off the UI thread | The Rust app-server is a separate child process (stdio transport, client name "Codex Desktop"); the SQL reads run there. The renderer gets JSON over Electron IPC. Syntax highlighting runs in a Web Worker (shiki). Search regex runs in a worker. JSON decode and state merge are on the renderer main thread (nothing found that moves them off). | `build/main-BbeJ4AAR.js`: class with `kind=\`stdio\``, `isLocalStdio:()=>e===\`local\`&&...u.kind===\`stdio\``, `clientInfo:{name:m.q,title:\`Codex Desktop\`...}`; `assets/shiki-highlight-provider-7d7ff5d6e309.js` (`new Worker(x,{type:"module"})` with `worker-1315d491af6d.js`); `assets/app-initial-8a7b00193cb6.js` (`regex-search.worker`) | High for process split and shiki worker; the "JSON decode stays on main thread" part is an absence finding, medium |
| 9 | Only visible turns are mounted | Hand-written bottom-anchored turn virtualizer. Height = measured, else `estimatedHeightPx`, else 280. Offset arrays, binary search (`o`, `s`), overscan 2 turns (`Pe=2`), initial viewport 800 px (`Me=800`), turn gap 12 px (`je=12`). Rows outside the window are blank blocks of estimated height. | `assets/thread-virtualizer-e1964ca5c039.js` (`c=280`, `bottomOffsetsPx`, binary search); `assets/virtualized-turn-list-a6c13e64a0c1.js` (`je=12,Me=800,Ne=8,Pe=2,Fe=10`); consumed by `local-conversation-thread-e87a41485cee.js` (`Ay`) | High |
| 10 | Browser skips layout of off-screen blocks inside a mounted turn | `content-visibility:auto` with `contain-intrinsic-size:auto 240px` on turn content, forced `visible` when an MCP app widget is expanded. | `assets/local-conversation-turn-d642e678c156.js` function `cs`: `[contain-intrinsic-size:auto_240px] [content-visibility:auto] [&:has([data-mcp-app-expanded='true'])]:[content-visibility:visible]`, attr `data-virtualized-turn-content` | High |
| 11 | Markdown is lazy only through the virtualizer | I found no markdown-specific lazy path (no IntersectionObserver, no idle callback, no worker, no cache in `conversation-markdown-*.js`). A turn is rendered when it enters the window or when `content-visibility` lets it paint. Turn items are mapped through a per-turn `WeakMap` memo (`GA`). | `assets/conversation-markdown-7ca5c75f7d4c.js` (grep: no `IntersectionObserver`, `requestIdleCallback`, `Worker`, `Map` cache); `local-conversation-thread-e87a41485cee.js` (`GA.set(e.turn,{...items:h...})`) | Medium (absence of evidence in minified code) |
| 12 | Scroll up loads older history | Content is laid out in "islands" with "gap" rows that carry an older and a newer boundary. A controller (`XO`) is told the viewport bounds; it fetches the boundary nearest the viewport centre once a gap is within 800 px (`ek=800`) of the viewport (or `4 viewports` for compact history). Fetch is `loadConversationHistoryBoundaryPage` -> `thread/turns/list` with `cursor`, `limit 5`, `sortDirection desc` for the older edge. | `local-conversation-thread-e87a41485cee.js`: `XO({fetchBoundary,getGaps,getProximityViewportCount,proximityThresholdPx=ek})`, `ZO` (nearest gap), `ek=800`, `nk` (wiring); `app-shared-44edd7bfa69c.js` `w$t` (`limit:a?.limit??5, sortDirection:r.edge===\`older\`?\`desc\`:\`asc\``, throws on unchanged cursor) | High |
| 13 | Prepend without a jump | New turns merge into the history keyed by `turn:<id>`. The virtualizer keeps the anchor turn: `ae` re-finds the rendered range by anchor key when `turnKeys` change; `i` (`distanceFromBottom + newBottom - oldBottom`) corrects scroll distance. Scroll is measured from the bottom, so content added above does not move the bottom-relative offset. | `thread-virtualizer-e1964ca5c039.js` (`r`, `i` exports); `virtualized-turn-list-a6c13e64a0c1.js` (`ae({anchorKey,layout,previousRange})`, `compensateScrollToDistanceFromBottomPx`) | High on design, medium on exact trigger (inferred) |
| 14 | Placeholder while older page loads | A spinner row "Loading older messages…" (or a "Try again" button on failure) sits in the gap row. | `virtualized-turn-list-a6c13e64a0c1.js` function `F` (`chatgpt.pagination.loading`, `chatgpt.pagination.retry`), exported as `r`; `local-conversation-thread-e87a41485cee.js` `Jk` renders it for a gap | High |
| 15 | Placeholder before the first page | No skeleton found. grep for `Skeleton`, `animate-pulse`, `loading-skeleton` in the thread and page chunks returned nothing. Only the trace `markFirstResponseVisible` (IntersectionObserver on a 1 px probe span) exists to measure first paint. | `local-conversation-thread-e87a41485cee.js` (no hits); `local-conversation-turn-d642e678c156.js` `xs` (`xe.markFirstResponseVisible`) | Medium (absence) |
| 16 | In-memory cache between opens | Conversations live in a store `Map` with their `turnHistory` islands and `itemsPagination`, removed only on archive or delete (`removeConversationStoreEntries`). Re-opening a `resumed` thread does not re-read. `resumeState` is `needs_resume`/`resuming`/`resumed`. The virtualizer also saves `turnHeightsByKey` and a scroll distance (`initialRestoreState`, `onRestoreStateChange`) so a re-opened thread restores measured heights and position. | `app-shared-44edd7bfa69c.js` (`removeConversationStoreEntries`, `evictConversation` reasons archive/delete only, `resumeState`); `virtualized-turn-list-a6c13e64a0c1.js` (`initialRestoreState`, `turnHeightsByKey`) | Medium: no size-based eviction found, but I did not read every writer to `conversations` |
| 17 | Disk cache | The only on-disk cache found is server side: `thread_history_1.sqlite` (the projection, step 6) and `state_5.sqlite` (thread list metadata, 92 MB here). The renderer keeps no history cache on disk that I found. | `~/.codex/` listing; `state/src/sqlite.rs` (`thread_history_db_path`) | Medium |
| 18 | Prefetch before the click | `prefetchSharedThreadTurns` (10-entry map, 60 s TTL) exists but throws unless the host is `durable` (cloud/shared threads). `prewarmConversation` prepares a new empty thread. Neither warms a local thread on hover. | `app-shared-44edd7bfa69c.js` (`prefetchSharedThreadTurns`: `if(this.client.getHostId()!==\`durable\`)throw`; `prewarmConversation` -> `prewarmThreadStart`) | Medium |

#### Answers to the questions

- **Newest page first?** Yes. Newest 5 turns, descending, then up to 100 items per request from the newest end, 500 items in total on the first page (steps 1 to 4).
- **Page size?** Turns: 5 from the client (server max 100). Items: 100 per request (server max 100, default 25). The client halves the item limit if a message is too large to decode (`nz`).
- **Cache between opens?** In memory yes (store plus virtualizer heights and scroll). On disk only the server's sqlite projection. No hover prefetch for local threads.
- **Off the UI thread?** App-server child process (SQL and JSON build), shiki worker, regex-search worker. Not: JSON decode, state merge, markdown render (renderer main thread).
- **Scroll-up?** Distance-based gap controller, 800 px lookahead, one boundary at a time, merge by turn id, anchor correction in the virtualizer (steps 12 and 13).
- **Markdown lazy?** Only because the virtualizer mounts about 2 extra turns and `content-visibility:auto` skips the rest.
- **Skeleton?** Not before the first page. A spinner row for older pages.

#### Same webview as the Cursor/VS Code extension?

Yes, same family and same constants. The extension (`~/.cursor/extensions/openai.chatgpt-26.908.40401-darwin-arm64/webview/assets/local-conversation-thread-df1707b9c9ee.js`) had the virtualizer inline. The desktop build (26.928) has split it into `thread-virtualizer-*.js` and `virtualized-turn-list-*.js`, with the same 280 px estimate, overscan 2, 800 px viewport and `content-visibility:auto` / 240 px. The extension is older by about three weeks; the desktop build adds the gap/island history model and `thread/turns/list` boundary paging. I only compared constants and function shapes, not the whole files.

#### Notes

- The earlier note (`feed-perf-codex.md`) said the server reads the rollout from the end with `reverse_jsonl_scanner.rs`. That is not the open path. `ReverseJsonlScanner` is used in `rollout/src/ordinal.rs`, `session_index.rs`, `thread-store/src/local/model_context.rs`, `tui/src/resume_picker_transcript_preview.rs`, not in `list_turns`/`list_items`. For paginated threads the open path is SQL on the projection. The scan only matters for legacy threads, and even they replay the whole file.
- The sqlite row `item_json` is already the API-shaped `ThreadItem`, so a page read does no rollout parsing (`thread_items.item_json` in the schema; `deserialize_stored_thread_item` in `thread_processor.rs`).
- First-paint cost on the renderer is therefore bounded by: 5 turn shells, at most 500 item JSON objects, and about (viewport 800 px + 2 turns each side) mounted turns, not by thread size.
- Cost of this design: index is about 3.3 GB for 3124 threads here (about 1 MB per thread on average), and a first open of an unprojected thread needs the projection step (not measured).

#### Dead ends

- No `Codex.app` in `/Applications`; `mdfind` on `*codex*` only finds ChatGPT.app and a Security Agent plugin.
- `local-conversation-thread-*` in the desktop build is a different file name from the extension's; the 280/overscan constants moved to `thread-virtualizer`.
- Could not find which flag combination (`te`, `E`, `_e`, `je`, `ne`) a plain local, idle, desktop thread takes in `app-shared-44edd7bfa69c.js`; so step 1 vs step 5 branch selection is unproven. A one-line trace (log the `thread/resume` params) would settle it.
- I did not run the app or time anything. No measurements here, only design.
- Did not read `rollout_migration/startup.rs` to learn when old rollouts are converted to paginated.
- Did not find where `GA` memo size is bounded (WeakMap keyed by turn object, so GC-bound).
- `hydrateBackgroundThreads` (sidebar) was not read; it may load summaries for recent threads ahead of a click.

### How Claude Desktop (Code tab) opens a large local session

Sources: main process in app.asar extracted to `scratchpad/claude-desktop/.vite/build/` (call it MAIN below);
renderer bundles decoded from `~/Library/Application Support/Claude/Cache/Cache_Data` (zstd bodies, call it RC; files named by cache hash, with the bundle name in `rcache/index.txt`).
All identifiers in MAIN and RC are minified, so every function name is an inferred reading. Constants and string literals are exact.

#### Table

| Step in the open path | Technique | Evidence | Confidence |
|---|---|---|---|
| 0. Before click | Main process can pre-start the worker that will do the reads (`prewarmTranscriptReads`) | MAIN `index.chunk-Nnw-A1di.js`: `prewarmTranscriptReads(){this.transcriptReadsInWorker&&this.transcriptPorts.prewarm()}` | high that it exists, low on when it is called |
| 1. Where reads run | Local session reads run in the "heavy-work utility process", not main, behind a flag. Log line: `[transcript-read] local-session reads run in the heavy-work utility process / in the main process` | `index.chunk-Nnw-A1di.js`: `transcriptReadsInWorker=t.MU("613003975")`; worker copy of the loader in `heavy-work-worker/heavyWorkWorker.js` (class `hy`, same code as `index.chunk-lssHJSpz.js`) | high (flag default unknown) |
| 2. Renderer to main request | Renderer asks for the newest page, not the file: `mode: Page, beforeUuid: "", limit: max(pageLimit,200), window: "accept"` | RC `cef1e6037-XrMP0tZi.js` `fetchTranscript`: `K.read({sessionId:e,mode:o.Page,beforeUuid:"",limit:l,...window})`, `l=Math.max(t?.pageLimit??0,200)`, `d=t?.backfill?"decline":t?.revalidate?"cached":t?.anchored?void 0:"accept"` | high |
| 3. Newest-page read ("window") | Read only the file tail, doubling: try last 1 MiB, then 5 MiB, stop as soon as enough rows are kept. Never reads the middle or head. Skips the leading partial line | `index.chunk-lssHJSpz.js`: `ue=[1048576,5242880,O]` (O=52428800); `loadNewestPageInner` uses `ue.slice(0,-1)` and `break`s when `m>c` (kept rows > page limit); `q()` reads `[start,end)` by offset, `skipLeadingPartial` | high |
| 3b. When the window read is refused | Falls back to a full read (named reasons: whole-file, short-window, sparse-first-rung, no-timestamp, sort-guard, page-start, rewritten, agent-files, cache-hit...) | `we=[...]` list and the `return{fallback:"..."}` branches in `loadNewestPageInner` | high |
| 4. Small file | If the first rung is >= file size, skip the window path, read it whole | `d>=o.size` -> `{fallback:"whole-file"}` | high |
| 5. Big file cap | Any full load reads only the last 50 MiB (`mainBytes`), subagent files 32 MiB, 100 MiB cached entry, 200 MiB cache total. Older history is marked `transcriptTruncated`, scope `"history"` | `ce={mainBytes:O,subagentBytes:ne,cachedEntryBytes:re,cachedTotalBytes:ie}`; `loadFullInner`: `Math.max(0,size-mainBytes)`, `skipLeadingPartial:!0`, warn `tail-loading last ${mainBytes} bytes` | high |
| 6. Stop at compact_boundary? | Not in this display loader. It does not scan for compact_boundary to cut the read; it keeps compact metadata (`preservedMessages/preservedSegment`) on rows for chain stitching in `loadRawChain`. The byte cap is the bound | `lssHJSpz` function `me()` copies compactMetadata only; no boundary scan in `loadFullInner`/`loadNewestPageInner` | medium (absence of a pattern) |
| 7. Parse | Line split on `\n` over a Buffer, `JSON.parse` per kept line, rows filtered by a keep rule (`E(e,c)`); large pre-filter `De()` skips lines containing agentId markers by byte match before parsing. Parse time and bytes are measured (`diag: readMs, parseMs, rowsParsed, rowsKept`) | `loadTail`/`loadNewestPageInner` in `lssHJSpz`; `De(e,t)` with `_e=['"agentId"',...]` | high (parse), medium (De purpose) |
| 8. Delivery to the UI | Rows go over a dedicated MessagePort (`transcript:port`, `MessageChannelMain`), not normal IPC, in chunks of at most 250 rows or a byte budget, yielding to the event loop (`setImmediate`) between chunks. Last chunk carries `done:true` | MAIN `uL` class (`cL="transcript:port"`, `new q.MessageChannelMain`); `heavyWorkWorker.js` `qb()` and `Eg(e,t={maxRows:250,maxBytes:wg})`, `Kb=()=>new Promise(e=>setImmediate(e))`; log `delivered N rows in M chunk(s) to renderer port` | high |
| 8b. Fallback transport | If no port, rows come back inline in the IPC reply (`via: Inline`) | `readTranscriptForRenderer` in Nnw: `via:t.vG.Port` vs `t.vG.Inline` | high |
| 9. Prepare then deliver | Two-step: worker reads and holds rows under a ticket (60 s expiry), main re-checks the session did not change (clear generation, rewind), then tells the worker to stream. Stale ticket -> fallback `revalidation` | `Vb/Wb` with `Rb=6e4`, `Pb` error "no prepared read for ticket"; `readNewestTranscriptPage` revalidation checks | high |
| 10. Warm after first paint | After the newest page is delivered, a background full load warms the cache once tail reads settle (250 ms then `setImmediate`) | `readNewestTranscriptPage`: `diskTranscriptWarmTranscriptCache` inside `whenTailReadsSettled(e,250).then(setImmediate(m))` | high |
| 11. Cache between opens (main/worker) | In-memory `diskTranscriptCache` per session keyed by mtime+size+ino. Same file -> return cached rows with no disk read. Grown file -> incremental read of only the appended bytes (`K(d,_.mainSize,g.size)`), if under cap. Not persisted to disk | `loadFullInner`: `_.mainMtimeMs===g.mtimeMs&&_.mainSize===g.size` -> return `_.messages.slice()`; `fe()` = `canIncremental/fitsCeiling`; `loadTail` returns `source:"cache"` | high |
| 11b. Cache between opens (renderer) | react-query style per-session message cache; opening a session again asks with `window:"cached"` (`revalidate`) so main can skip the window read (`renderer-cached`). Under memory pressure old sessions are trimmed to 50 rows | RC `cef1e6037-XrMP0tZi.js` (`revalidate?"cached"`), main `readNewestTranscriptPage`: `window==="cached"?"renderer-cached"`; RC `shared-17-DnQT2GAm.js`: `if(o<=50)return 0; s=n==="pressure"?50:LU(a,50)` | medium (inferred from minified) |
| 12. Paging up | `fetchEarlierTranscript` asks for `beforeUuid` cursor, limit 200 per page. Triggered by scroll/anchor logic; a hidden walk can also page up in the background (`fetchTranscriptAbove`, max walks `uf`) | RC `cef1e6037-XrMP0tZi.js` `fetchEarlierTranscript` (`limit:200`), `hasEarlierTranscript`; RC `c11959232-Dt6Kvr8c.js` history walk | high (API), medium (trigger) |
| 13. Tail-only API | Separate `getTranscriptTail(limit<=500)` with the same 1 MiB / 5 MiB / 50 MiB ladder, serves cache if file unchanged | Nnw `performTranscriptTailRead`: `Math.min(t|0,500)`; `loadTail` ladder `ue` | high |
| 14. List rendering | Custom windowed list, not react-virtuoso/react-window: row estimator, measured size map, overscan 600 px above and below (`g9=600`), start with overscanTop 0 then widen after 2 presented frames (`initialWindow.release.afterPresentedFrames:2`), `skipNoopRenders`, anchor compensation when rows above change height, pin-to-bottom | RC `c1c1ec7b9-BJxY6LIm.js` (file hash `da9e6e34...`): `zte({items,getKey,estimate,overscanTop:g9,overscanBottom:g9,retainOverscan:!0,initialSizes,initialViewport,initialWindow:{overscanTop:0,overscanBottom:g9,bottomInset:0,release:{afterPresentedFrames:2,...}}})`, `g9=600`. `estimateSize:An` -> `rIe(e,t,kn)` | high (shape), medium (names) |
| 14b. Reopen without remeasure | Per-session view state saved on leave: pinned flag, anchor row key and offset px, `sizes:new Map(...)`, viewport. Fed back as `initialSizes`, `initialViewport` | same file: `m_.save(e,{isPinned,anchorKey,anchorSourceId,anchorOffsetPx,latestAt,sizes:new Map(m),viewport...})`, `initialSizes:ge?.sizes,initialViewport:()=>We??null` | medium (in-memory only; persistence option is `"none"`) |
| 15. Lazy markdown / tool rows | A "fragments" store holds rendered prose per row: `ensure(key)`, `release(keys)`, `prose(key)`, `pending`, `releasable`, `seed`. Offscreen rows can be released and replaced by a placeholder of known pixel height (`placeholderKey, px`). Performance marks `code-transcript:fold`, `:refold`, `:release` | RC `21f17ddd1e3a6b77_0` (store with `release/ensure/seed/prose`) and `K9()` (`restoreSizes`, `performance.measure("code-transcript:refold")`); `da9e6e34...` snippet `U(),P(S.map(e=>[e.placeholderKey,e.px]))` | medium (inferred, I did not trace the markdown parser itself) |
| 16. Resume after opening (agent runtime) | Separate: when the user sends a message the Claude Code engine reloads its own context with its own loader. That loader is a copy in the app: `kj=1048576, Aj=5242880`, `CLAUDE_CODE_DISABLE_PRECOMPACT_SKIP`, scans for `"compact_boundary"` bytes and drops pre-boundary content when file > 5 MiB | MAIN `index.chunk-Dun3kJZF.js`: `function wV(e,t,n){... if(t>Aj&&!fA.CLAUDE_CODE_DISABLE_PRECOMPACT_SKIP) return (await Kj(e,t,r)).postBoundaryBuf`, `Kj` streams 1 MiB reads; same marker in `claude-code/bin.strings` | high (code present), medium (that the desktop uses it for resume, not display) |

#### Answers

- First paint: tail read, not the whole file. Renderer asks for newest 200 rows. Worker reads the last 1 MiB, then 5 MiB if too few rows survive filtering, parses only that, and streams rows over a MessagePort in chunks of at most 250 rows. The list starts with zero upward overscan and widens after two painted frames.
- Paging: 200 rows per page by `beforeUuid` cursor (`fetchEarlierTranscript`), plus a 500-row cap on the tail API. History past the 50 MiB window is simply marked truncated; the full-load path never reads the file head.
- Caching between opens: yes, but in memory only. Worker keeps parsed rows per session keyed by mtime/size/inode with incremental append reads, 100 MiB per entry, 200 MiB total. Renderer keeps rows and a per-session view state (row heights, anchor, pin). I found no on-disk index or parsed-transcript cache in `~/Library/Application Support/Claude` (the `claude-code-sessions` dir holds session metadata only; not opened for content).
- Off the UI thread: file read, split and JSON.parse run in the heavy-work utility process when the flag is on; delivery over a MessagePort so no main-process hop; the renderer parse is not needed because rows arrive as objects. Fall back is main process.
- Virtualization: custom windowing engine (`zte`), measured heights with anchor compensation, 600 px overscan, offscreen row release with placeholders. Not react-virtuoso, react-window or tanstack in the transcript (tanstack `useVirtualizer` style `estimateSize` exists only in picker lists: `cccc2cf0a-DDI_-aVC.js`, `c63275c0a-BUdkA7os.js`).
- Lazy markdown/tools: fragment store with ensure/release is the mechanism I could find (medium confidence); I did not find `content-visibility` use in the transcript path (it appears in many bundles, I did not tie it to the list).

#### Dead ends and gaps

- Plain `grep` over the cache finds nothing: bodies are zstd. I decoded all 18,869 cached JS bodies with Node 24 `zlib.zstdDecompressSync` into `scratchpad/rcache/`.
- Many versions of each bundle sit in the cache (old releases). I used those with the newest cache mtime. Names (`zte`, `m_`, `g9`) change per build.
- `react-virtuoso`, `react-window`, `FixedSizeList`, `useVirtualizer` do not appear in the transcript bundles.
- I did not find where `prewarmTranscriptReads` is called from, nor the default value of flag `613003975` (a remote gate; cannot be read offline).
- `index.chunk-B2pgMh2t.js` and `index.chunk-Des3qCSt.js` hold a different loader (`Fe=52428800`, `Re()` scans the last 30 MiB (`t-31457280`) for the last compact_boundary, `truncation-notice` row). It belongs to the local-agent (Cowork) path by inference, not the Code tab list.
- I did not measure timings on a real 238 MB transcript (largest in `~/.claude/projects`); this is code reading only.

### How desktop agent GUIs open a large session

Clones are in `/private/tmp/claude-501/-Users-milad-Developer-argo/75c2ecf5-4d9a-4b6c-933c-123c5b28a29b/scratchpad/guis/` (shallow, HEAD as of 2026-10-02).
Conductor was inspected read-only (copied its two SQLite files into `scratchpad/cond/` to read the schema; no message content was read).
Paths below are relative to each repo root. Confidence: high = read in code; med = code plus inference; low = inferred only.

#### Table

| App | Step in the open path | Technique | Evidence | Confidence |
|---|---|---|---|---|
| opcode | Read the transcript | Read the whole `~/.claude/projects/<p>/<id>.jsonl`, parse every line to `serde_json::Value`, return one big `Vec` over one Tauri IPC call. No paging, no cache. | `src-tauri/src/commands/claude.rs` `load_session_history` | high |
| opcode | Prepare for render | Renderer maps all entries, stores them in React state, also keeps a second copy as `JSON.stringify` strings (`rawJsonlOutput`). | `src/components/ClaudeCodeSession.tsx` `loadSessionHistory` | high |
| opcode | Filter | `displayableMessages` filter scans backwards through earlier messages for each tool result (quadratic in the worst case). | `ClaudeCodeSession.tsx`, `displayableMessages` useMemo (around lines 200-260) | high |
| opcode | Virtualize | `@tanstack/react-virtual`, `estimateSize: () => 150`, `overscan: 5`, rows measured with `measureElement`. | `ClaudeCodeSession.tsx` `useVirtualizer` (about line 263); `package.json` | high |
| opcode | Markdown | `react-markdown` inside `StreamMessage`, wrapped in `React.memo`. Not lazy. Only visible rows render because of the virtualizer. | `src/components/StreamMessage.tsx` lines 11, 739 | high |
| opcode | First paint position | After load, `setTimeout(100)` then `scrollToIndex(last)` plus a raw `scrollTo`. Starts at the bottom. | `ClaudeCodeSession.tsx` `loadSessionHistory` | high |
| opcode | Fix history | None for large sessions. No issue or PR about large-session load found. Only #180 (UI lag, a Linux/Windows rendering report, no fix). | `gh issue list -R winfunc/opcode -S "slow"`, `-S "lag"` | med |
| Crystal | Where data lives | Does not read `~/.claude`. It spawns Claude itself and writes every stdout JSON line into its own SQLite table `session_outputs` (better-sqlite3). Opening is a query. | `main/src/database/schema.sql`; `database.ts` `addSessionOutput`, `addPanelOutput` | high |
| Crystal | Query | Old path `sessions:get-output`: `ORDER BY timestamp DESC, id DESC LIMIT ?` then reverse. Default limit 5000. Newest-first paging, but only a limit, no cursor. | `main/src/ipc/session.ts` `sessions:get-output` (`DEFAULT_OUTPUT_LIMIT = 5000`); `database.ts` `getSessionOutputs` | high |
| Crystal | Current Rich view query | The panel view calls `panels:get-json-messages`, which calls `getPanelOutputs(panelId)` with no limit. So the current view loads every row and sends them in one IPC reply. | `main/src/ipc/session.ts` `panels:get-json-messages`; `frontend/src/components/panels/ai/MessagesView.tsx`; `preload.ts` line 573 | high |
| Crystal | Format | Old path formats JSON in batches of 100 (`BATCH_SIZE`), which does not yield to the event loop (a plain loop, no await between batches). | `session.ts` `sessions:get-output` | high |
| Crystal | Render | No virtualization library in `frontend/package.json`. `RichOutputView` builds every message element in one `useMemo` (`renderedMessages`), groups consecutive tool-only messages. `react-markdown` is a dependency. | `frontend/src/components/panels/ai/RichOutputView.tsx` lines 1482-1530; `frontend/package.json` | high |
| Crystal | Fix history | Issue #192 "Main-thread locking performance issues" (user compares with Conductor, "pretty smooth"). PR #193 (v0.3.1) fixed git polling, terminal output frame drops, session list listener leak. Nothing about session open or paging. | `gh issue view 192`, `gh pr view 193`, `CHANGELOG.md` | high |
| Vibe Kanban | Where data lives | Agent output is written by the server to one JSONL log file per execution process (legacy: SQLite `execution_process_logs`, JSONL text per row). A "session" is a list of execution processes (one per turn or script). | `crates/services/src/services/execution_process.rs` `load_raw_log_messages`, `read_execution_logs_for_execution`; migration `20250729162941_create_execution_process_logs.sql` | high |
| Vibe Kanban | Normalize | Server replays stored log through the executor's normalizer into JSON patches and streams them over a WebSocket (`/api/execution-processes/<id>/normalized-logs/ws`). In-memory `MsgStore` ring of about 100 MB. | `crates/server/src/routes/execution_processes.rs` `stream_normalized_logs_ws`; `crates/utils/src/msg_store.rs` `HISTORY_BYTES`, `history_plus_stream` | high |
| Vibe Kanban | Page newest-first | Client loads processes from newest to oldest. First `MIN_INITIAL_ENTRIES = 10` entries, emitted as `initial`; then background batches of `REMAINING_BATCH_SIZE = 50`, emitted as `historic`. The unit is a whole turn (one WebSocket per process), not a message. | `packages/web-core/src/features/workspace-chat/model/hooks/useConversationHistory.ts` `loadHistoricEntries`, `loadRemainingEntriesInBatches`; `.../shared/hooks/useConversationHistory/constants.ts` | high |
| Vibe Kanban | Still loads everything | The background loop keeps going until all processes are loaded. Only the first paint is fast. Proposal to load older history only on scroll is open (PR #3425). | `useConversationHistory.ts` (the `while` loop at the end); PR #3425 | high |
| Vibe Kanban | Virtualize | TanStack Virtual (migrated from Virtuoso in PR #3173, merged 2026-03-19). `OVERSCAN = 8`. Size estimates by row type (compact 40, medium 80, tall 280, dynamic 150) and, for text rows, a character-count estimate (chars per line from container width, capped at 12,000 px). Last 8 rows (more while streaming, 24) are left unvirtualized to keep bottom-lock stable. | `packages/web-core/src/features/workspace-chat/model/useConversationVirtualizer.ts`; `.../model/conversation-row-model.ts` `SIZE_ESTIMATE_PX`, `estimateTextRowHeight`; `.../ui/ConversationListContainer.tsx` (`ALWAYS_UNVIRTUALIZED_TAIL_ROWS = 8`, `STREAMING_UNVIRTUALIZED_BUFFER_ROWS = 24`) | high |
| Vibe Kanban | Debounce updates | 100 ms debounce on entry updates to the list while history streams in. | PR #1909 | high (PR text) |
| Vibe Kanban | Wire format | Batched gzip WebSocket frame for history (24 MB over 1800 frames, 90+ s on slow links). The PR was closed, not merged. | PR #2946 (closed) | high |
| Vibe Kanban | Fix landed: quadratic replay | Stored Codex sessions with heavy stderr never loaded (4.0 MB log: 40.3 s to 0.105 s after fix). Fix: coalesce already-available stderr chunks before the normalizer (`ready_chunks`). Also replay patches overflowed the 100 MB ring and evicted the real conversation. | Issue #3455; PR #3456 (merged 2026-09-17) | high |
| Vibe Kanban | Fix landed: runaway memory | Server RSS 9-10 GB from repeated workspace-summary refetch and duplicate scratch writes. Fix reduced refetch and deduped writes. | Issue #3373 (closed); PR #3372 (closed; fix described in issue) | med |
| Vibe Kanban | Still open | #1140 "Large conversations take up a lot of memory and slow down the interface" (asks for last-N plus load more on scroll). #2624 asks to load only the last round. #2166 frontend freeze on a large binary tool result. #3352 possible leak in long-lived sessions. PR #3425 (stream raw JSONL from disk, cap record size, bound history, load older processes only near the top) is open. | `gh issue list -R BloopAI/vibe-kanban`; PR #3425 | high |
| claude-devtools (extra) | Read | Reads `~/.claude/projects/...jsonl` directly. Streams lines with `readline` over `createReadStream`, `JSON.parse` per line, in the Electron main process. | `src/main/utils/jsonl.ts` `parseJsonlFile` | high |
| claude-devtools | Build | Parse, resolve subagents, build chunks (semantic steps), then cache the whole `SessionDetail` in memory. Cache is LRU-ish, `maxSize = 50`, TTL 10 min (defaults), keyed by project and session, validated by fingerprint `mtimeMs-size`. | `src/main/ipc/sessions.ts` `handleGetSessionDetail`; `src/main/services/infrastructure/DataCache.ts` constructor | high |
| claude-devtools | IPC | Raw `messages` stripped before crossing IPC (renderer never uses them), cutting payload and renderer heap by about 50-60% (per code comment). One IPC reply for the whole session, not chunked. | `src/main/ipc/sessions.ts` end of `handleGetSessionDetail` | high |
| claude-devtools | Refresh | Renderer passes back the last fingerprint. If the file is unchanged, main returns `{ unchanged: true }` after one `stat()`. Adaptive debounce on refresh scales with session size. | PR #187 (fixes #186), PR #120 (merged) | high |
| claude-devtools | Virtualize | TanStack Virtual only when 30 or more items (`VIRTUALIZATION_THRESHOLD = 30`); `estimateSize` fixed 260 px, `overscan: 8`, measured with `getBoundingClientRect`. Leaf item components in `React.memo` (PR #103 closed; PR #163 says memo already present). | `src/renderer/components/chat/ChatHistory.tsx` lines 40-41, 185, 206-211; PR #163 | high |
| claude-devtools | Memory | Renderer heap exhaustion after about 24 h: incremental conversation transform reuses unchanged items (O(N) to O(delta)); fingerprint skip; strip raw chunks after transform; O(N^2) spreads removed. | PR #120 (merged) | high |
| claude-devtools | Open (not merged) | Parse in a Worker Thread (30 s timeout, inline fallback), optional Rust mmap parser (claimed 5-10x), lazy subagent transcripts, bounded caches. | PRs #167, #168, #170 (all open) | high (PR text only; not benchmarked here) |
| Conductor | Where data lives | Local SQLite `conductor.db`: table `session_messages` (id, session_id, role, content, sent_at, turn_id, sdk_message_id, ...) with indexes on `(session_id, sent_at)`, `turn_id`, `sdk_message_id`, and a user-turns index. It stores messages itself; opening a session is a query, not a JSONL parse. | `~/Library/Application Support/com.conductor.app/conductor.db` `.schema` and `.indexes session_messages` | high |
| Conductor | Client cache | A second DB `cache.db` mirrors `session_messages` with `source_rowid`, indexed by `(session_id, sent_at)`, plus `client_cache_session_state` (session_id, `feed_offset`, `primary_max_rowid`, `primary_message_count`, `cache_version`, `cache_revision`, `last_read_at`). Reads as a cache of the primary DB that tracks how far it is synced. | `cache.db` `.schema` | high (schema); med (how it is read, not seen) |
| Conductor | Pending queue | Separate tables for queued messages (`session_pending_messages`, `session_pending_messages_state`). | `cache.db` `.schema` | high |
| Conductor | Stack | Tauri app (Rust, wry) with an alacritty terminal and a sidecar. Binary strings include `tauri`, `wry`, `TAURI_INTERNALS__`, `alacritty_terminal`. The sidecar is separate (`sidecar-v2-session-event-outbox/`). | `strings` on `/Applications/Conductor.app/Contents/MacOS/conductor` (v0.85.0) | med (inferred from strings) |
| Conductor | Virtualization, paging, markdown | Not determined. The web frontend is embedded in the binary (likely compressed) and no virtualization library name appears in `strings`. | `strings` grep for virtuoso, react-virtual, legend-list: no hits | low (unknown) |

#### Per-app notes

##### opcode (Tauri, reads ~/.claude)
- Open path: click session -> `loadSessionHistory` -> one `invoke("load_session_history")` -> Rust reads the full file, drops lines that fail to parse (`if let Ok`), returns every message in one reply -> React state -> filter -> virtualizer.
- Cost grows with file size at every step: read, `serde_json::Value` for every line, IPC serialization, a JS copy plus a stringified copy, an O(n^2)-prone filter. No streaming, no limit, no cache.
- What it does well: the virtualizer, `React.memo` on rows, and landing at the bottom.
- Session list (`get_project_sessions`) reads file metadata and scans files for the project path and first message, so the list also touches every JSONL file (code at `claude.rs` line 473; I did not trace the per-file scan cost).
- Opcode is a good example of the naive baseline.

##### Crystal (Electron, own SQLite)
- Crystal is a different shape: it owns the run, so it records each streamed JSON line as it arrives. Opening an old session never touches `~/.claude`.
- That makes the open path a query with an index-friendly `ORDER BY ... LIMIT`. This is the "store parsed messages in our own DB" technique.
- Weak spots: rows are raw JSON text, so the renderer still parses and transforms them. The newer panel path drops the limit, and the UI does not virtualize, so a long session renders every message. The 5000 cap exists only on the older `sessions:get-output` path.
- A user reported main-thread stalls and named Conductor as the smooth reference (#192). The fix did not touch history loading.

##### Vibe Kanban (Rust server plus web UI, also Tauri shell)
- Best-documented code. Two ideas worth copying: (1) load newest turns first and paint after about 10 entries, then fill older turns in the background in batches of 50; (2) size estimates from text length so scroll height is close before rows are measured.
- Its main wins came from fixing server-side replay cost (#3455/#3456, quadratic work per chunk) rather than from the client. Lesson: a transform that is fine live can be quadratic on replay.
- Open weakness: the background loader still pulls every turn, so memory and time grow with session length (#1140, #2624). PR #3425 moves older history to scroll-triggered loading and streams the JSONL from disk with a per-record size cap.
- The Virtuoso to TanStack migration (#3173) came with a layered model: semantic timeline -> turns -> entries -> rows, each with stable keys.
- Not checked: whether markdown or tool output is lazily rendered inside rows. `DisplayConversationEntry.tsx` uses a `ChatMarkdown` component; I did not look for lazy loading.

##### claude-devtools (extra: Electron, reads ~/.claude)
- Chosen because it reads the same files as Argo and has several landed fixes for long sessions.
- Open path: stat file -> fingerprint -> cache hit returns immediately; miss runs stream parse, subagent resolve, chunk build -> strip raw messages -> one IPC reply.
- Strengths: fingerprint short-circuit at the IPC boundary (`{ unchanged: true }`), a main-process cache keyed on `mtime-size`, incremental re-transform on file growth, and virtualization only above 30 items.
- Weakness: the first open of a big session still parses the whole file on the main process. The Worker Thread / Rust parser PR (#167) targets that and is still open, as are the lazy subagent PRs (#168, #170).
- Perf fixes that landed: #120 (heap), #187 (no-op refresh), #163 (CSS: removed `backdrop-filter`, scoped `transition-all`, `backgroundThrottling: false`). Issue #186 turned out to be an Intel build running under Rosetta, not code.

##### Conductor (closed source, Tauri)
- It stores messages in SQLite, so opening is a query. The schema shows the author optimized for read patterns: `(session_id, sent_at)` index, `turn_id` and `sdk_message_id` columns, so grouping by turn is a column match, not a parse.
- The separate `cache.db` plus sync state (`feed_offset`, `primary_max_rowid`, `cache_revision`) suggests an incremental feed from the primary store into a client cache, and a version number to invalidate it. This is inferred from column names only.
- This machine's data is small (493 rows, 6 sessions in cache, largest `content` 75 KB), so I could not see behavior at scale.
- Frontend technique is unknown. I did not decompress the embedded bundle.

#### Dead ends

- Conductor frontend: no virtualization or markdown library names in the binary strings; assets are embedded and probably compressed. Did not unpack them.
- Conductor `feed_offset` in `cache.db`: all NULL on this machine, so no sample of how it is used.
- opcode issue search for "large session", "virtualize", "freeze": no relevant large-session reports (the "large session" hit was #465, a path bug).
- Crystal issue search for "slow", "freeze": empty. "large" hits were feature requests only.
- Vibe Kanban PR #2946 (gzip batch) was closed, so do not count it as landed. PR #3372 was also closed; its change was described in issue #3373.
- A GitHub repo search for "claude code jsonl session viewer desktop virtualized" returned nothing; found claude-devtools by name.
- Not measured: no app was run and no timings were taken. All timings quoted come from the PR or issue text.

### How VS Code's Chat view keeps a long feed fast

Source: shallow clone of github.com/microsoft/vscode, `main` at commit ef6de2591ba7 (2026-10-02, sparse checkout of `src/vs/workbench/contrib/chat` and `src/vs/base/browser/ui/list`). Issue facts come from the GitHub API. Paths below are relative to `src/vs/` unless they start with `workbench/`. `W/` = `workbench/contrib/chat/browser/widget/`.

#### Summary table

| Technique | Where it applies | Evidence location | Confidence |
|---|---|---|---|
| Virtualized tree: only rows in the viewport are in the DOM | The whole feed | `W/chatListWidget.ts` (`WorkbenchObjectTree` with `supportDynamicHeights: true`); `base/browser/ui/list/listView.ts` `render()`, `getRenderRange()`, `getVisibleRange` | High |
| Row template pool: DOM rows and their toolbars are reused, not rebuilt | Every row | `base/browser/ui/list/rowCache.ts` `RowCache.alloc/release`; `W/chatListRenderer.ts` `renderTemplate`, `disposeElement`, `disposeTemplate` | High |
| Height cache keyed by element, with an estimate for unseen rows | Row sizing and scrollbar | `base/browser/ui/list/list.ts` `CachedListVirtualDelegate` (WeakMap); `W/chatListRenderer.ts` `ChatListDelegate` (default 200px, then `currentRenderedHeight`) | High |
| Measure only rendered rows, then correct scroll with an anchor | Dynamic row height | `listView.ts` `_rerender`, `probeDynamicHeightForItem`; `W/chatListRenderer.ts` `fireItemHeightChange`, `reconcileChatItemHeight` | High |
| Height change events deduped and deferred to the next frame | Streaming rows | `W/chatListRenderer.ts` `reconcileChatItemHeight`, `fireItemHeightChange`; issue #326952 | High |
| Rate-matched streaming of markdown, one render per frame | The streaming row only | `W/chatListRenderer.ts` `getProgressiveRenderRate`, `doNextProgressiveRender`, `doIncrementalRender`; `W/chatContentParts/chatIncrementalRendering/chatIncrementalRendering.ts` `IncrementalDOMMorpher`; `.../buffers/wordBuffer.ts` | High |
| Only the last response streams; older rows render once, in full | Streaming policy | `W/chatListRenderer.ts` `renderChatTreeItem` (`isStickyScrollTargetItem`) | High |
| Skip streaming work while the view is hidden | Hidden panel | `W/chatListRenderer.ts` `_isVisible`, `setVisible`, guards in both render paths | High |
| Content diff: patch existing parts, never rebuild the response | Streaming row | `W/chatListRenderer.ts` `diff`, `renderChatContentDiff`, `renderChatResponseBasic` | High |
| Pooled code editors | Code blocks | `W/chatContentParts/chatContentCodePools.ts` `EditorPool`, `DiffEditorPool`; `chatCollections.ts` `ResourcePool` | Medium (read the pool, not the sizes) |
| Collapsed "thinking" and tool blocks build their children on first expand | Tool invocations | `W/chatContentParts/chatThinkingContentPart.ts` `lazyItems`, `hasExpandedOnce` | High |
| Capped height for streaming thinking text | Thinking part | `chatThinkingContentPart.ts` `THINKING_SCROLL_MAX_HEIGHT = 200` | High |
| Scroll lock, follow-the-stream, bottom padding reservation | Streaming scroll | `W/chatListWidget.ts` `_scrollLock`, `_withPersistedAutoScroll`, `updateBottomPadding`, `scrollToEnd` | High |
| Keyed re-render: `setChildren` with a diff identity string | History restore and updates | `W/chatListWidget.ts` `refresh()` | High |
| Sticky header of the current user prompt | Long feeds | `W/chatListWidget.ts` options `enableStickyScroll`, `stickyScrollMaxNodeHeight: 150` | Medium (UX, not perf) |
| CSS `contain: strict` on the rows container | List | `listView.ts` constructor, `transformOptimization` | Medium (only if the option is on; I did not trace the default) |

#### 1. Virtualized list, only visible rows in the DOM

- The chat feed is a `WorkbenchObjectTree` created in `W/chatListWidget.ts` (constructor, around line 598) with `supportDynamicHeights: true`, `horizontalScrolling: false`, `setRowLineHeight: false`. The tree sits on `ListView`.
- `ListView.render()` (`listView.ts` ~line 923) computes the visible range, takes `Range.relativeComplement` against the previous range, removes rows that left and inserts rows that entered. There is no overscan: `getRenderRange` is just `getVisibleRange` plus the current text-selection bounds, so a selection keeps its rows alive.
- Row DOM nodes are pooled by `RowCache` (`rowCache.ts`): `alloc(templateId)` pops a released row or calls `renderer.renderTemplate`; `release` returns it. `cache.transact()` wraps a render so a row removed and re-added in the same pass is not detached.
- The chat renderer uses one template id, `ChatListItemRenderer.ID`, for requests, responses and the pending divider (`ChatListDelegate.getTemplateId`). One template shape, so any row can be reused for any item.
- Template work is split: `renderTemplate` builds header, avatar, toolbars, footer once. `renderElement` fills it. `disposeElement` clears element-scoped disposables and drops maps keyed by request id and clears toolbar contexts so the pooled row does not hold the view model. The rendered content parts are intentionally NOT disposed in `disposeElement` ("so they can be reused when a new render is started", `clearRenderedParts` comment); they go in `clearRenderedParts` and `disposeTemplate`.
- Caveat: a user issue still asks for DOM virtualization (#297349, #316407). Those reports predate or ignore the tree virtualization; the reporter assumed all messages are in the DOM. The source shows the list is virtualized, so the lag in those reports must come from something else (see section 12 and dead ends). Confidence that the list is virtualized: high. Confidence about what causes the reported lag: low.

#### 2. Row height measurement and caching

- `ChatListDelegate extends CachedListVirtualDelegate` (`W/chatListRenderer.ts` ~line 5733). `CachedListVirtualDelegate` (`list.ts` line 146) keeps a `WeakMap<element, number>`. `getHeight` returns the cached value, else `estimateHeight`. The chat estimate is `element.currentRenderedHeight ?? defaultElementHeight`, default 200 (`chatListWidget.ts` line 538).
- `hasDynamicHeight` returns true for every element, so each row in the render range is probed.
- Probing (`listView.ts` `probeDynamicHeightForItem`, ~line 1717): clear the row's inline height, read `offsetHeight`, store, return the diff. Only rows currently in the render range are measured; unseen rows keep the estimate until they scroll in. The scrollbar length is therefore an estimate for old rows.
- `_rerender` (~line 1586) loops until no row changes height. It remembers an anchor element (the second visible row, or the first if at its top) and restores `scrollTop` so the content does not jump when heights change. It cites #104144, #107704 and PR #104284 for smooth scrolling.
- `updateElementHeight(index, size)` (~line 570 to 640): if the resized row is above the viewport, it adjusts scroll top by the diff instead of letting the view jump.

#### 3. Height change handling during streaming

- Content parts call back into `fireItemHeightChange(template, measuredHeight?)` (`chatListRenderer.ts` ~line 1018). It skips rows that are detached, sticky rows, and zero heights, rounds up with `Math.ceil`, then asks `reconcileChatItemHeight` (pure function, ~line 520) what to do:
  - `none`: same as known height. No work. This is the dedupe.
  - `deferReMeasure`: the measurement arrived inside `renderElement`. Do not notify the tree re-entrantly. Re-measure at the next animation frame.
  - `fire`: height is known and changed. Notify `onDidChangeItemHeight`, which `chatListWidget.ts` line 570 routes to `_updateElementHeight` -> `_tree.updateElementHeight`, wrapped in `_withPersistedAutoScroll`.
  - `scheduleInitial`: first measurement; only notify (next frame) if the content would be clipped by the allocated height.
- This was a real bug source: #326952 (closed) "Chat response renders correctly but stays visually stale/clipped until window resize (fireItemHeightChange swallow bug)". The fix is the `deferReMeasure` branch and the rule "do not advance `currentRenderedHeight` when the tree was not told".
- Lesson for any app: store the last height you TOLD the list, not the last height you measured.

#### 4. Progressive markdown rendering while streaming

Two paths exist.

Legacy path (default when `chat.experimental.incrementalRendering.enabled` is off, `common/constants.ts` line 143):
- `doNextProgressiveRender` runs on a 50 ms `WindowIntervalTimer` (`timer.cancelAndSet(runProgressiveRender, 50, ...)`, `chatListRenderer.ts` ~line 1935).
- `getNextProgressiveRenderContent` picks how much content to show this tick. The rate comes from `getProgressiveRenderRate` (~line 1071): words per second, taken from `element.contentUpdateTimings.impliedWordLoadRate`, clamped to 40..2000 while streaming, min 80 after completion, 8 when unknown.
- It then diffs against `renderedParts` and renders only the changed parts. If nothing new, it returns and the timer stops until the next model update.

Experimental incremental path (`chat.experimental.incrementalRendering.*`):
- `IncrementalDOMMorpher` (`chatIncrementalRendering.ts`): append-only, rAF-batched (`_rafScheduled`, `_pendingMarkdown`). Pure appends are morphed; if the markdown is not a pure append, `tryMorph()` returns false and the caller does a full re-render.
- A buffer decides when to commit: `WordBuffer` (`buffers/wordBuffer.ts`) reveals words based on elapsed time and a rate set from `updateStreamRate`. Same constants as the legacy rate (MIN_RATE 40, MAX_RATE 2000, MIN_RATE_AFTER_COMPLETE 80, DEFAULT_RATE 8). Other buffers: `paragraphBuffer.ts`, `offBuffer.ts`, registered in `bufferRegistry.ts`.
- Animation is separate (`animations/`), a pluggable reveal style.
- Each commit still goes through the normal `doRenderMarkdown` path, so code blocks, tables and KaTeX work. The cost is a re-render of that markdown part per frame, not per token.
- Known rough edges, still open: #336883 (re-animates the whole response when a file reference appears), #337916 (stability when inline references stream in).
- Both paths bail when the view is hidden (`if (!this._isVisible) return`, lines 2999 and 3101).

#### 5. Only the last response streams

- In `renderChatTreeItem` (~line 1920): progressive rendering runs only if the element is a response, is the "sticky scroll target item" (the last non-pending item) and is not complete (or still has `renderData`). Every older row renders once, in full, via `renderChatResponseBasic`.
- When a response completes, the renderer does a final non-destructive diff pass rather than a rebuild ("not a destructive re-render", `doIncrementalRender` comment).

#### 6. Content diff instead of rebuild

- `renderChatResponseBasic` calls `this.diff(templateData.renderedParts, content, element)` then `renderChatContentDiff`. The diff returns `null` for parts that are already correctly rendered. Existing DOM parts are kept; only new or changed parts are created or replaced (`renderChatContentDiff`, ~line 3242).
- A comment at ~line 2078 explains references are always added up front "to avoid shifting the content parts ... and having to re-diff all the content".
- When a row comes back after virtualization with parts intact, `remountRenderedParts` re-registers code block registrations and calls `onDidRemount` instead of re-rendering (~line 3037).

#### 7. Collapsing tool invocations and long output

- `ChatThinkingContentPart` (`chatThinkingContentPart.ts`) holds tool items as `lazyItems` of type `ILazyToolItem` with a `Lazy<{domNode, disposable, isVisible}>`. On first expand it sets `hasExpandedOnce` and builds the deferred children (~line 581). A collapsed block never pays for its children.
- Streaming thinking text is shown in a scrollable box capped at `THINKING_SCROLL_MAX_HEIGHT = 200` px (line 232); `maxHeight` is set to `0px` when collapsed (lines 658 and 945).
- A title cache with `TITLE_CACHE_MAX_ENTRIES = 1000` (line 236) with oldest-first eviction (~line 1750).
- `ChatCollapsibleContentPart` is the shared base; a user toggle changes row height, so the list widget tracks it with `UserToggleResizeTracker` and restores a scroll anchor (`chatListWidget.ts` ~lines 170 to 225, `trackUserToggleResize`).
- Completed responses can collapse earlier tool chains behind a disclosure (`updateCompletedResponseDisclosure`, `renderedCollapsedToolChains`); `finishProgressCollapse` / `flushPendingProgressContent` keep collapsed content off-DOM until needed ("pending collapse content remains off-DOM", `updateBottomPadding` comment).

#### 8. Pooled code editors

- `EditorPool` and `DiffEditorPool` (`chatContentCodePools.ts`) wrap `KeyedResourcePool<CodeBlockPart>` / `ResourcePool<CodeCompareBlockPart>` from `chatCollections.ts`. Monaco editors are expensive, so a block that leaves the viewport releases its editor to the pool. I did not read the pool's size policy (not verified).

#### 9. Scroll behaviour while streaming

- `_scrollLock` defaults to true (`chatListWidget.ts` line 382). While locked and at the bottom, height changes are wrapped by `_withPersistedAutoScroll` so the view stays pinned to the end. A scroll-down button appears when not at bottom (`computeScrollDownState`, line 141).
- `isScrolledToBottom` uses a 2 px tolerance (`scrollTop + renderHeight >= scrollHeight - 2`, line 442).
- `scrollToEnd` uses a big offset (`Math.max(lastElement.currentRenderedHeight ?? 0, 1e6)`, ~line 1264) so it reveals the end even if the last row's height is not yet known.
- `AutoScrollHolds` lets features pause following.
- `paddingBottom` plus `_scrollHeightReservation` keep the scroll height stable when a response collapses on completion, so the user's position does not jump (`updateBottomPadding`, ~line 1131). It measures flushed content first and releases the reservation on a rAF.

#### 10. History restore

- `ChatWidget.setModel` -> `listWidget.setViewModel` (just stores the model) and `ChatWidget.onDidChangeItems` -> `listWidget.refresh()` (`chatListWidget.ts` ~line 905). `refresh` calls `_tree.setChildren(null, treeItems, { diffDepth: 1, diffIdentityProvider })`.
- `diffIdentityProvider.getId` builds a string from `dataId` plus state suffixes (reference count, undo state, editing, blocked, last-item, setting counter). Only rows whose string changes are re-rendered. The `_last` suffix makes just the old and new tail rows re-render when the list grows.
- Restored history is therefore not rendered in full: only the viewport rows get `renderElement`, using the height estimate (200 px) until measured. Heights of restored rows are NOT persisted across reloads; `currentRenderedHeight` lives on the view model element in memory (`ChatListDelegate.estimateHeight` comment). So after a reload the scrollbar is estimated until rows are visited. This is inferred from the code; I did not find any persisted height store.
- Persistence cost is a separate problem: #285251 "Persisting long chat sessions is slow and causes renderer freezes" and #338282 "avoid blocking session persistence on edit stats".

#### 11. Other small things worth copying

- `rowRoot` class toggling for request vs response so CSS can style rows without per-row JS (`renderChatTreeItem`, "hack @joaomoreno").
- Tree option `stickyScrollMaxNodeHeight: 150`: the sticky prompt header is capped so it cannot eat the viewport.
- Template-scoped hovers and toolbars are cleared in `disposeElement` so a pooled row never keeps a dead view model alive.
- `traceLayout` logging gated by `forceVerboseLayoutTracing` for diagnosing layout bugs.

#### 12. What users still report (not root causes)

All open, user-reported, no maintainer diagnosis seen:
- #297349 "Chat panel should virtualize DOM for long conversations". Body asserts all messages stay in the DOM. Contradicted by the source above for the main chat view.
- #316407 "Copilot Chat rendering becomes sluggish during long conversations". Comments report thinking stream lagging behind the model.
- #328610 "constantly freezes for several seconds in long chats". 60,000-line chat. Streaming advances only about once a second. Compaction did not help. Links to #285251 (persistence freezes).
- #325495, #335969 (general lag after 1.133). Not read in detail.
Reading: freezes in very long chats plausibly come from model/persistence/view-model work on the whole session (serialization, `getItems()` per row, `diffIdentityProvider` over every item in `refresh`) rather than DOM size. That is my inference, not confirmed in a primary source. Note `refresh()` computes an id string for every item on each model change, which is O(items); `renderChatTreeItem` also calls `getStickyScrollTargetItem(this.viewModel.getItems())` per rendered row.

#### Dead ends and gaps

- `microsoft/vscode-copilot-chat`: the repo has `src/extension`, `src/platform`, `src/lib`, `src/util`. The chat widget, list and renderer are in core `microsoft/vscode`, not in the extension. I did not search it further for rendering code.
- `gh search issues` returned empty arrays; `gh api search/issues` worked. Release notes were not read; I relied on issues and source only. No release-note citation for chat perf work.
- I did not read `chatMarkdownContentPart.ts` in depth (how markdown is rendered per commit, any size limit). A grep for markdown length limits found none.
- I did not verify the `transformOptimization` default for `contain: strict`.
- I did not measure anything. All claims are from reading code at one commit. There is no benchmark or profile in the repo for chat list rendering that I found.
- No `IntersectionObserver`, no `content-visibility`, no per-row "skip render if offscreen" in the chat parts (grep of `chatMarkdownContentPart.ts` and `chatThinkingContentPart.ts` found only `Lazy`).
- The `sticky scroll` for chat is experimental (`ExperimentalStickyScrollEnabled`, `chat.experimental.stickyScroll.enabled`).

### How Zed's agent panel keeps a long feed fast

Source: shallow sparse clone of github.com/zed-industries/zed at commit 57bfce2945c96103421bbdc4cc98fc2de5efe2fa (2026-10-01), crates agent_ui, gpui, markdown, acp_thread, agent, sum_tree. All paths below are under crates/. I did not open zed.dev blog posts (see dead ends).

#### Summary table

| Technique | Where it applies | Evidence location | Confidence |
|---|---|---|---|
| Virtualized list with variable heights, heights cached per item in a SumTree | The whole conversation feed | gpui/src/elements/list.rs: `ListState`, `StateInner.items: SumTree<ListItem>`, `ListItem::{Measured,Unmeasured}`, `ListItemSummary` | High |
| Only items in the viewport plus a 2048px overdraw are rendered or measured | Feed layout each frame | list.rs `layout_items`; agent_ui/src/conversation_view.rs `ListState::new(0, ListAlignment::Top, px(2048.0))` | High |
| Re-measure only the changed entry, keep scroll offset | Streaming text, tool result updates | list.rs `remeasure_items`, `PendingScroll::Absolute`; conversation_view.rs `AcpThreadEvent::EntryUpdated` | High |
| Cache invalidated wholesale only when list width changes | Window or panel resize | list.rs `Element::prepaint` (width compare, all items set to `Unmeasured`) | High |
| Tail following: stick to bottom while streaming, release on user scroll up, re-engage at bottom | Streaming | list.rs `FollowMode::Tail`, `FollowState`, `scroll`, `layout_items`; conversation_view.rs `set_follow_mode(Tail)` | High |
| Scroll position saved on scroll and restored on thread open | Reopening a thread | thread_view.rs `set_scroll_handler` (defer + `set_ui_scroll_position` + `schedule_save`); conversation_view.rs `scroll_to(ui_scroll_position)` else `scroll_to_end` | High |
| Markdown parsed on a background thread, parse coalesced, old result shown until the new one lands | Every assistant message, thinking block, tool text | markdown/src/markdown.rs `Markdown::parse`, `start_background_parse`, `pending_parse`, `should_reparse` | High |
| Markdown parse is NOT incremental: each parse reparses the full source | Streaming | same file: `append` concatenates the whole string, `start_background_parse` calls `parse_markdown_with_options(&source, ...)` | High (negative finding) |
| Code block syntax highlights computed at parse time, in the background, cached | Code blocks in messages | markdown.rs `compute_code_block_highlights` inside `start_background_parse`; test `test_code_block_highlights_cached_at_parse_time` | High |
| Streamed text is revealed on a 16 ms timer, paced to finish in about 200 ms | Streaming assistant text | acp_thread/src/acp_thread.rs `StreamingTextBuffer` (`TASK_UPDATE_MS = 16`, `REVEAL_TARGET = 200.0`), `TextCursor` | High on mechanism; medium on whether perf was the goal (comment says UX reveal) |
| Tool call bodies collapsed by default; content only built when expanded | Tool cards, terminal cards | agent_ui/src/entry_view_state.rs `expanded_tool_calls` (starts empty), `is_tool_call_content_visible`; thread_view.rs `render_tool_call` (`tool_output_display = if is_open`), `render_terminal_tool_call` (`.when(is_expanded && terminal_view.is_some())`) | High |
| Bounded heights for inner scroll areas | Terminal output (`h_72` when scrollable), thinking preview (`max_h_64`), floating tool body, edited files, plan (`max_h_40`), images (`max_h_96`) | thread_view.rs `render_terminal_tool_call`, `render_thinking_block`, `render_tool_call`; `ThinkingBlockDisplay` | High |
| Thinking blocks: auto-open while streaming, auto-collapse after, constrained preview | Thinking | entry_view_state.rs `auto_expand_streaming_thought`, `thinking_block_state` | High |
| Terminal view embedded with a line cap | Terminal cards | entry_view_state.rs `create_terminal` (`set_embedded_mode(Some(1000), cx)`) | Medium (I did not open `set_embedded_mode` in terminal_view, not in the sparse checkout) |
| Terminal output cut before sending to the model (not a display cap) | Token cost | acp_thread/src/terminal.rs `truncated_output`, `output_byte_limit`; header tooltip in `render_terminal_tool_call` | High, but about tokens, not rendering |
| Per-entry view state held outside the list, reused across frames | Editors, terminals, diff editors per entry | agent_ui/src/entry_view_state.rs `EntryViewState`, `sync_entry`, `Entry` | High |
| Thread loaded on a background executor from SQLite, zstd-compressed JSON, one blob per thread | Thread open | agent/src/db.rs `ThreadsDatabase::load_thread` (`executor.spawn`), `deserialize_thread`, `save_thread_sync`, `DataType::Zstd`; `list_threads` reads metadata columns only | High |
| Generating indicator is an extra list item, not an overlay | Streaming | thread_view.rs `sync_generating_indicator` (`list_state.splice`) | High |

#### Virtualization and height caching

`gpui::List` is the feed. The module docs say it renders "a large number of differently sized elements efficiently" and that items outside the scrolled area must not change height unless the owner calls `splice` or `reset` (gpui/src/elements/list.rs, top of file).

- State: `ListState(Rc<RefCell<StateInner>>)` lives on the view. `StateInner.items` is a `SumTree<ListItem>`. Each leaf is `Unmeasured { size_hint, .. }` or `Measured { size, .. }`. The summary (`ListItemSummary`) carries `count`, `height`, `rendered_count`, `unrendered_count`, `has_focus_handles`, `has_unknown_height`. Cursors seek by `Count` or by `Height`, so "which item is at pixel Y" and "total content height" are tree lookups, not scans (`scroll` uses `items.find::<ListItemSummary,_>(..., &Height(new_scroll_top), Bias::Right)`).
- Layout (`StateInner::layout_items`): starts at the scroll-top item, walks down. Items inside the visible height are rendered and measured. Items in the trailing overdraw are only rendered if they have no cached size; otherwise the cached height is used. Then it walks up to fill leading overdraw. The new measured items are spliced back into the tree (`cursor.slice` / `append`). So steady-state frames render the visible items only.
- Overdraw: the agent thread passes `px(2048.0)` (agent_ui/src/conversation_view.rs near `ListState::new(0, gpui::ListAlignment::Top, px(2048.0))`). The doc comment on `ListState::new` says overdraw items are measured so the list does not flicker. The scrollbar total is therefore an estimate until items are measured. `with_uniform_item_height` and `measure_all` exist as options to fix scrollbar size; I did not see the agent thread use them.
- Width change: `Element::prepaint` compares `last_layout_bounds.size.width`; on change every item becomes `Unmeasured` with no size hint. This is the one full re-measure path, and it is lazy (only visible plus overdraw items are re-rendered).
- Per-frame cost still includes building the elements of visible items every frame; there is no retained element cache for rendered children. Not found in code, so not claimed.
- `uniform_list` (gpui/src/elements/uniform_list.rs) measures only the first item and assumes the rest are the same. Used by archive/list UIs, not the thread feed. The thread feed uses `list`. `threads_archive_view.rs` also uses `ListState`.

#### Re-measuring only what changed

The thread view maps thread events to list calls (agent_ui/src/conversation_view.rs, thread event handler):
- `NewEntry`: `sync_entry` then `list_state.splice_focusable(index..index, [focus_handle])`.
- `EntryUpdated(index)`: `sync_entry`, then `list_state.remeasure_items(index..index + 1)`. That rebuilds the tree range as `Unmeasured` (keeping size hint and focus handle) so only that item is re-measured on next layout.
- `EntriesRemoved(range)`: `splice(range, 0)`.
- `remeasure_items` records `PendingScroll::Absolute { item_ix, offset }` if the changed item is the scroll-top item, so the pixel offset into it is kept while its height changes. `layout_items` applies it after the item is re-rendered. A user scroll rebases that pending value (`rebase_pending_scroll`) so it does not undo the scroll; there are tests `test_remeasure_then_scroll_does_not_revert_scroll_position` and `test_scroll_after_remeasure_clamps_to_shrunk_item_height`.
- `remeasure()` (all items, `ScrollAnchor::Proportional`) is for font size changes.
- A focused item that is scrolled off screen is still rendered so keyboard input works (`splice_focusable`, end of `layout_items`).

#### Scroll anchoring while streaming

- The thread list is `ListAlignment::Top` with `set_follow_mode(FollowMode::Tail)` (conversation_view.rs). In `layout_items`, when `follow_state.is_following()`, `scroll_top` is forced to `{ item_ix: item_count, offset_in_item: 0 }`. The "walk up to fill" branch then lays out from the end, so the bottom of the last item stays visible while it grows.
- `scroll()`: a scroll with `delta.y > 0` (up) calls `follow_state.stop_following()`. Later layouts re-enable it when the scroll offset is back within 1px of the bottom (`has_stopped_following` check in `layout_items`).
- `pause_following_tail()` freezes position without leaving Tail mode. The thread view uses it when expanding a compaction block so the list does not jump to the end (thread_view.rs `toggle_compaction_expansion`).
- `scroll_to_end()` sets the anchor to `item_count`, so it holds even while the last item is still growing (doc comment on that method).
- Tests in list.rs document the behaviours: `test_follow_tail_stays_at_bottom_as_items_grow`, `test_follow_tail_disengages_on_user_scroll`, `test_follow_tail_disengages_on_scrollbar_reposition`.
- Scroll offset persistence: `set_scroll_handler` callback defers (cx.defer) because the list state is borrowed, then stores `logical_scroll_top` on the thread and calls `schedule_save`. On open: `list_state.scroll_to(ui_scroll_position)` or `scroll_to_end()`. The offset is `(item_ix, offset_in_item)`, so it survives a different pixel layout.

#### Streaming markdown

- Each text or thinking chunk owns an `Entity<Markdown>`. Streaming calls `Markdown::append(&str)` (acp_thread.rs call sites near `markdown.append(&text.text, cx)` and in `StreamingTextBuffer::reveal`).
- `Markdown::append` builds a new `SharedString` of the full source (`self.source.to_string() + text`) and calls `parse`. It is not incremental. Cost per update is O(total message length), done off the main thread.
- `parse`: if a parse is already running, only sets `should_reparse = true` and returns. When the running parse finishes, `start_background_parse`'s completion closure runs `this.parse(cx)` again if `should_reparse` is set. Result: at most one parse in flight per message, and bursts of chunks collapse into the next parse. This is the main protection against parse work growing with chunk rate.
- The parse runs in `cx.background_spawn`. It runs `parse_markdown_with_options`, resolves code block languages through the language registry, decodes data-URL images, and computes `code_block_highlights` (`compute_code_block_highlights`). The main thread only swaps `parsed_markdown` in. `Markdown::reset` explicitly keeps the old parsed content visible until the new parse finishes ("Don't clear parsed_markdown here").
- Paint: `MarkdownElement::request_layout` walks all `parsed_markdown.events` of that message each layout and builds styled text. There is no block-level virtualization inside one message; the list item is the unit. A very long single message therefore re-lays out entirely on each update. `ParsedMarkdown.root_block_starts` exists but I only saw it used for active-block and selection logic.
- Pacing: acp_thread.rs `StreamingTextBuffer` keeps a `TextCursor` over the retained source and reveals bytes every 16 ms (`TASK_UPDATE_MS`) at a rate chosen to drain pending text in about 200 ms (`REVEAL_TARGET`). The code comment says this lets the UI reveal text gradually without changing the authoritative message. It also caps markdown updates to about one per frame. I treat the perf benefit as a side effect.

#### Collapsing and bounding tool output

- Default collapsed: `EntryViewState.expanded_tool_calls` is a `HashSet<ToolCallId>` that starts empty. `is_tool_call_content_visible` is true if expanded or if the call is waiting for authorization. `render_tool_call` builds output children only `if is_open`. Terminal card (`render_terminal_tool_call`) adds the terminal view only `when(is_expanded && terminal_view.is_some())`.
- Bounded when open: the terminal body is `div().h_72()` if the terminal content is scrollable, otherwise natural height. Thinking blocks in Preview mode get `max_h_64()` with a top gradient and track a `ScrollHandle` that auto scrolls to bottom while streaming (`render_thinking_block`, `ThinkingBlockDisplay::{Auto, Preview, AlwaysExpanded, AlwaysCollapsed}`). Floating tool bodies, edited-files and plan lists use `max_h_40` plus `overflow_y_scroll`. Images use `max_w_96`/`max_h_96`.
- Terminal embedding: `create_terminal` calls `set_embedded_mode(Some(1000), cx)`; I read this as a 1000-line cap but did not open the callee.
- Model-side truncation (`Terminal::truncated_output` with `output_byte_limit`, tooltip text "only X was sent back to the agent") limits tokens. It does not limit what the card renders; the card shows the terminal scrollback bounded by `MAX_SCROLL_HISTORY_LINES` (named in the tooltip branch).
- Thinking blocks auto-open while the last chunk is a thought and auto-collapse afterwards unless the user toggled them (`auto_expand_streaming_thought`).

#### Per-entry view state and eager creation

- `EntryViewState` holds one `Entry` per thread entry: a `MessageEditor` for user messages, terminal views, diff editors for tool calls. `ConversationView` calls `sync_entry(ix, ...)` for every entry when a thread is attached (loop `for ix in 0..count` in conversation_view.rs). So view entities for ALL entries are created up front, but only visible ones are rendered by the list. This is a cost I would flag: opening a 5,000-entry thread builds 5,000 entry states (every user message gets an editor). I did not measure it.
- State that should survive re-render (expanded sets, thinking toggles, compaction expansion) lives on `EntryViewState`, keyed by tool call id or `(entry_ix, chunk_ix)`, and is re-indexed on removal (`reindex_after_removal`).

#### Loading threads from the database

- agent/src/db.rs `ThreadsDatabase`: one row per thread in table `threads` (id, parent_id, folder paths, summary, updated_at, created_at, data_type, data). `data` is zstd-compressed JSON (`DataType::Zstd`, `zstd::encode_all` / `decode_all`).
- `list_threads` selects only metadata columns, never the blob, ordered by `updated_at DESC`.
- `load_thread` runs inside `self.executor.spawn` (background), reads the single row, decompresses and `serde_json` parses it. It is whole-thread, not paged: a long thread is loaded fully, then `AcpThread::replay` (agent/src/agent.rs, call at `thread.update(cx, |thread, cx| thread.replay(cx))` in `open_thread`) builds entries, and the UI creates view state for each (above). The list virtualization is what keeps first paint cheap, not lazy loading.
- Saving is also off the main thread (`save_thread_sync`, "serialization, zstd, disk I/O") and is scheduled from the scroll handler through `schedule_save`.

#### What this means for a feed in another stack (my reading, not Zed's words)

1. Cache one measured height per item, keyed by item id; invalidate one item on content change, all items only on width change.
2. Anchor scroll as (item, offset in item), not pixels; restore after re-measure; follow-tail flag that user scroll-up clears and returning to bottom sets.
3. Parse markdown off the main thread, one parse in flight, a dirty flag to coalesce, keep showing the old result.
4. Collapse tool output by default and do not build the body when closed; give every open body a max height.
5. Zed does NOT solve: incremental markdown parsing, virtualization inside a huge single message, or lazy per-entry state creation. Those are open gaps if the target feed needs them.

#### Dead ends and gaps

- No incremental markdown parser in `crates/markdown`. Searched for append-only or tree-reuse logic; `parse` always takes the whole `source`.
- No row-level pagination of thread history in `agent/src/db.rs`; one blob per thread.
- `crates/terminal_view` and `crates/terminal` were not in my sparse checkout, so the 1000-line embedded mode and `MAX_SCROLL_HISTORY_LINES` value are not verified.
- zed.dev blog and docs on GPUI rendering were not fetched. Primary code was enough for the questions; a blog post could add intent but not evidence. Not consulted, so no claim relies on them.
- `crates/gpui/src/elements/uniform_list.rs` is not used by the thread feed. Only skimmed its header.
- I did not run Zed or profile anything; "fast" is inferred from structure and from the list's tests, not measured.
- `StreamingTextBuffer` pacing: purpose (UX vs perf) is my inference from the doc comment.
- `with_uniform_item_height` / `measure_all` were not found in agent_ui thread use (grep of `ListState` in agent_ui/src showed only `new`, `splice_focusable`, `remeasure_items`, `splice`, `reset` in the archive view).

### How OpenCode and Cline keep a long agent feed fast

Clones read (shallow, 2026-10-01 HEAD): scratchpad/opencode, scratchpad/cline.
Note: sst/opencode now lives at github.com/anomalyco/opencode (gh search works only on that name).
Note: Cline's webview moved to apps/vscode/webview-ui (not top-level webview-ui).

#### Table

| App | Technique | Evidence location | Confidence |
|---|---|---|---|
| OpenCode web/desktop | Row-level virtual list (TanStack Virtual), one row per semantic piece (user text, assistant part, context group, diff), not one per turn | packages/app/src/pages/session/timeline/message-timeline.tsx (`createVirtualizer`, `estimateSize` 60px, `overscan`); PR #26949 (merged), #29373 (closed), #32331 (merged, replaced Virtua) | High |
| OpenCode web | Stable row keys plus row reuse: new row list is diffed against the old one and unchanged rows keep object identity, so Solid skips them | timeline/projection.ts (`reuseTimelineRows`), timeline/row-reconciliation.ts | High |
| OpenCode web | Measurement cache per session (last 16 sessions) so switching tabs paints at the right heights | message-timeline.tsx `timelineCache`, `initialMeasurementsCache`, `takeSnapshot()` in `onCleanup` | High |
| OpenCode web | Small overscan at first mount (6 if warm or bottom-anchored), 20 after two frames; active streaming row always forced into the rendered range | message-timeline.tsx `renderOverscan`, `rangeExtractor`, `messageLastRowIndex` | High |
| OpenCode web | Bottom anchoring done by the virtualizer (`anchorTo: "end"`, `followOnAppend`, `scrollEndThreshold: 80`); resize anchor is a microtask, skipped while user is scrolling | message-timeline.tsx `anchorResizedBottom`, `virtualizer.resizeItem` override | High |
| OpenCode web | Big-row-resize guard: when a row jumps by more than a viewport, rows on screen are pinned in the range for two frames | message-timeline.tsx `resizePinnedIndexes` | High |
| OpenCode web | Message pagination: first page 20 messages, then 200 per "load more" with a cursor, prepended with scroll anchor capture/restore | packages/app/src/context/server-session.ts (`initialMessagePageSize`, `historyMessagePageSize`, `history.loadMore`), message-timeline.tsx `capturePrependAnchor` | High |
| OpenCode web | Session cache eviction (40 sessions) and pinned sessions | context/global-sync/session-cache.ts (`SESSION_CACHE_LIMIT`), server-session.ts `evict`/`pin` | High |
| OpenCode web | Incremental streaming markdown: text split into blocks, finished blocks are cached (200 entries) and not re-parsed; only the open tail block re-renders; parse runs in a worker | packages/session-ui/src/components/markdown-stream.ts, markdown-cache.tsx (`max = 200`), markdown.worker.ts, markdown.tsx (`streaming` prop) | High (code), Medium (exact wins, see PR #32331 numbers) |
| OpenCode web | Syntax highlighting in a dedicated worker; nested diff virtualization turned off inside the virtual timeline | packages/session-ui/src/pierre/worker.ts; message-timeline.tsx `virtualize={false}` on diffs; PR #28422 | Medium |
| OpenCode web | Fine-grained reactivity (Solid stores, `createMemo` per row), so a streamed delta touches one part, not the list | context/global-sync/event-reducer.ts (`message.part.delta`, `part_text_accum_delta`), message-timeline.tsx per-row memos | Medium (reasoned from structure, no benchmark of this alone) |
| OpenCode TUI | No virtualization. Plain `<scrollbox stickyScroll stickyStart="bottom">` with `<For each={messages()}>` over all loaded messages; relies on OpenTUI (Zig renderer) | packages/tui/src/routes/session/index.tsx ~line 1180-1200 | High |
| OpenCode TUI | Only loads the newest 100 messages at session open | packages/tui/src/context/sync.tsx line ~603 (`session.messages({ limit: 100 })`) | High |
| OpenCode TUI | `streaming={true}` flag on `<markdown>` and `<code>` for the live part | tui/src/routes/session/index.tsx lines ~1635, ~1692 | High |
| OpenCode old Go TUI | Block cache plus binary search for first visible block; synthesize only visible rows; shimmer gated to bottom and backlog under 2000 lines | PR #3346 (CLOSED, not merged; Go TUI no longer exists) | Medium (design only, never landed) |
| Cline | Virtuoso list over grouped rows, `increaseViewportBy` top 3000px and bottom MAX_SAFE_INTEGER (renders everything below the viewport) | apps/vscode/webview-ui/src/components/chat/chat-view/components/layout/MessagesArea.tsx `<Virtuoso>` | High |
| Cline | No `followOutput`; own pin-to-bottom: effects on list length and tail ts, debounced smooth scroll, 40/50/70ms instant "settle" scrolls, wheel-up disables auto scroll | MessagesArea.tsx effects; chat-view/hooks/useScrollBehavior.ts (`scrollToBottomSmooth`, `handleWheel`, `keepPinnedToBottomAfterLayout` 500ms) | High |
| Cline | Row memo with `deepEqual` comparator | ChatRow.tsx `memo(..., deepEqual)` | High |
| Cline | Only the LAST row measures height (react-use `useSize`) and calls back to re-pin; other rows skip it | ChatRow.tsx lines ~102-126 | High |
| Cline | Message combining before render: merge api_req start/finish, merge command + output, merge hooks; filter invisible; group browser sessions; group "low-stakes" tools (read, list, search) into one tool-group row; reasoning folded into groups | ChatView.tsx (`combineApiRequests`, `combineCommandSequences`, `filterVisibleMessages`, `groupMessages`, `groupLowStakesTools`); chat-view/utils/messageUtils.ts; src/shared/combineApiRequests.ts | High |
| Cline | Partial-message streaming: each partial replaces the message by `ts` in a reducer (higher `seq` wins); no batching or throttle on the webview side; only that row changes identity | webview-ui/src/context/ExtensionStateContext.tsx (subscribeToPartialMessage); chat-view/messageReducer.ts | High (no throttle found) |
| Cline | Collapsed rows by default; expansion in a `expandedRows` map keyed by ts; expanding turns off auto scroll | useScrollBehavior.ts `toggleRowExpansion`; ChatRow.tsx `isExpanded` | High |
| Cline | `key={task.ts}` remounts Virtuoso per task; `initialTopMostItemIndex` starts at bottom | MessagesArea.tsx | High |
| Cline | Fast path for empty list: loader rendered outside Virtuoso because cold Virtuoso needs several frames to measure | MessagesArea.tsx comment on `showEmptyListLoader`; PR #12746 (merged) | High |

#### OpenCode web and desktop

- It is a Solid app (packages/app, packages/session-ui, packages/ui). The desktop app wraps the same app.
- Timeline code lives in packages/app/src/pages/session/timeline/. The path is: server messages -> `createTimelineProjection` (projection.ts) -> `Timeline.constructSessionMessageRows` (rows.ts) -> `reuseTimelineRows` -> TanStack virtualizer -> `VirtualTimelineRow`.
- Row identity: `TimelineRow.key(row)` is the virtualizer `getItemKey`. Stable keys let measurements survive prepends and replacement.
- History: the app asks for 20 messages first, then 200 more per request with a cursor (`server-session.ts`). When older pages arrive, `capturePrependAnchor` / `restorePrependAnchor` keep the visible row still (loop of up to 180 frames waiting for sizes to settle).
- The history of the virtualizer matters. PR #26949 (merged 2026-05-18) moved from per-turn to per-row virtualization with the `virtua` library. PR #28422 (merged 2026-05-25) fixed collapse state and overlap with a patched virtua. PR #29373 tried TanStack and closed. PR #32331 (merged) replaced Virtua with TanStack Virtual and added measurement caches, a worker for streaming Shiki, and incremental markdown/code DOM updates. It reports, on a MacBook Air with a 30x busy stream: 22.8 to 51.4 FPS, p95 frame 116 ms to 33 ms; hot tab switch first paint 60.8 ms to 15.9 ms. These numbers are the PR author's own claims, I did not re-run them.
- The same PR lists a known gap: rare jump when a very large expanded diff (about 77,000 px fixture) settles above the viewport.
- Perf probes exist in the repo: packages/app/e2e/performance/timeline/session-timeline-stream-probe.ts.

#### OpenCode TUI

- Current TUI is packages/tui (OpenTUI + Solid). It does not window the message list; it relies on the native renderer and loads only the newest 100 messages (`sync.tsx`).
- The older Go TUI had a virtualization PR (#3346) that was closed unmerged. Useful as a design sketch only.

#### Cline

- Stack: React, react-virtuoso ^4.12.3 (webview-ui/package.json).
- Rows fed to Virtuoso are the output of a pipeline in ChatView.tsx: combine, filter, group. Fewer, fatter rows. Low-risk tool calls collapse into one group row (ToolGroupRenderer), so a 200-step exploration is a handful of rows.
- Virtuoso is told to render everything below the viewport (bottom = MAX_SAFE_INTEGER) and 3000px above. The code comment says this is so the last message is always mounted for a smooth scroll-to-bottom, and the top buffer stops jumping on collapse. So the list is virtualized only in the upward direction in practice; the cost is that a long tail below the viewport is mounted while the user reads old rows.
- It sets `overflowAnchor: none` to stop browser scroll anchoring from fighting Virtuoso.
- Streaming: partial updates hit React state as full `clineMessages` array copies (reducer copy per partial). Row memo with `deepEqual` means unchanged rows do not re-render, but the deepEqual itself walks props for every row on each update. I found no throttle, rAF batching or typewriter limit in the data path.
- Pin-to-bottom is hand built, with several timers (10ms debounce, 40/50/70ms, 500ms). Several fix PRs show how fragile this is: #11436 (merged, restore aggressive pin), #11825 and #11873 (merged, command output pinning), #12527 (open, keep reading position), #12746 (merged, thinking indicator).

#### What landed for lag reports

- OpenCode: PRs #26949, #28422, #32331 above (all merged). Also #35375 (merged, "optimize large review panes") and #51122 (merged, TUI virtualize large added-file diffs), both about diff panes, not the feed.
- Cline: I found no PR or issue about long-conversation lag or render cost. The scroll PRs above are about correctness. The only perf-shaped change is the empty-list loader fast path (#12746).

#### Dead ends

- `gh search ... --repo sst/opencode` errors; use anomalyco/opencode.
- Cline issue searches ("lag", "slow", "freeze", "performance chat history") returned nothing in gh search. This may be a search limit, not proof that no issue exists. Not verified by browsing.
- OpenCode issue searches for lag returned nothing; same caveat.
- No `followOutput` anywhere in Cline (grep). Their pin logic replaces it.
- OpenCode TUI: no `viewportCulling` or message windowing found (grep). OpenTUI internals (is there culling inside the scrollbox?) were not read; claims about it would be unverified.
- Did not read `rows.ts` row construction in detail, nor the Shiki worker protocol; marked Medium.
- Did not run either app, so no measured numbers of my own.
