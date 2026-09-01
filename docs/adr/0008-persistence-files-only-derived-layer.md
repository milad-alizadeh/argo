# Persistence: files only; the derived layer is the only durable state

**Context.** ADR-0005 (since deleted with the Electron runtime — ADR-0023) originally specified a `better-sqlite3` mirror for the "durable subset (session history, outcomes)." That reimported argo-v2's shape (v2 used a Drizzle SQL DB) and was challenged: a database for what is essentially "remember what Argo derived" is over-intrusive, and the stock CLIs already persist the authoritative session content as files.

Facts on the ground: `claude` writes one JSONL transcript per session under `~/.claude/projects/<project>/`; `codex` writes one JSONL per session under `~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl` (plus `archived_sessions/`), each opening with a `session_meta` line carrying a stable session UUID and `cwd`. Both CLIs already own the transcript-on-disk, keyed by a stable id.

**Decision.**
- **No database.** All persistence is plain files — no SQLite, no ORM.
- **Argo persists only its own derived layer** — Outcomes (with provenance / honesty-tier) and CONVENTION-tier plugin reports that arrived over the MCP channel and therefore never existed in a transcript. It never duplicates transcript content, the Agent tree (#182: "Actor"→"Agent"), or live status — those are live in memory or re-derivable from the CLI JSONL.
- **No persisted roster.** The set of Sessions is *discovered* every launch by scanning the CLI transcript dirs (the single source of truth) and held in memory. Argo writes nothing about which-Sessions-exist.
- **All Sessions are observed, not only Argo-managed ones.** A Session started in a plain terminal is discovered and rendered from its transcript at DIRECT/DERIVED tiers; only Argo-**managed** Sessions (companion plugin loaded) additionally carry the CONVENTION-tier derived layer.
- **Store shape:** one JSONL file per Session, keyed by the CLI's session id — `<userData>/sessions/<cliSessionId>.jsonl`. Each line is one derived record (`{ ts, kind: "outcome" | "report", text, tier, ref }`, `ref` pointing to the backing diff/artifact). Location is Electron's `userData` dir (app-global, survives updates, never inside a repo or the CLIs' own dirs).
- **I/O model — cache, computed once:** a derived record (e.g. an Outcome) is **computed once when produced, then persisted as a cache.** Reopening the app reads it back verbatim and **never regenerates it** — no staleness checks, no recompute-on-open. Append-on-event, off the hot path (a crash loses at most the last line, never corrupts the file); lazy read per Session on open. Launch scans the CLI dirs for the roster and touches no derived files.
- **Discovery & the rail's working set:** the rail shows **running + recently-active** Sessions, discovered by a **`stat`-based sweep** of the CLI dirs (filter by mtime). **Never the full history at launch** — which can be thousands of files per project — and finished history is an on-demand surface. **Amended by #1000:** the window is a **week**, and what holds that constraint is no longer the window being small. See *Amendment · the window is a week, and a gate holds what it used to* below.
- **Resume chains:** Claude writes a *new* file with a *new* sessionId on resume, chained to its parent by a head `leafUuid` pointer (`{"type":"last-prompt","leafUuid":…}`). The cache stays keyed by the real per-file sessionId (**no re-key on resume**); at read time Argo **stitches the chain** into one logical rail Session whose Outcomes are the **union of the per-file caches** along the chain. (Codex's resume shape must be verified the same way before relying on it.)
- **Liveness is honesty-tiered:** a **managed** Session's liveness is **DIRECT** (Argo owns the pid). An **external** Session's liveness is **DERIVED** — inferred by matching a running `claude`/`codex` process (cwd + recency) plus transcript mtime; no match → exited. Ambiguity resolves *down* (toward idle/exited); Argo never renders a false DIRECT "running" for a Session it doesn't own.
- **Outcome `ref` is git-addressed:** an Outcome's backing diff is one or more **commit SHAs** (repo = the Session's cwd) — immutable and resolvable across relaunch. No commit backing → **no stable link** (at most a clearly-marked ephemeral working-tree diff), never a fabricated ref.

**Why.** The CLIs already are the durable source of truth for session content, so Argo's only unique, non-reconstructable state is the thin derived layer. One JSONL per Session mirrors exactly how the CLIs themselves store — greppable by hand, no schema/migration, trivially GC'd (delete the one file when its transcript is gone). Discovering the roster instead of persisting it guarantees a single source of truth and the least intrusive footprint. This is the "everything is files" model all the way down.

**Consequences.**
- ADR-0005's `better-sqlite3` mirror is **withdrawn**; with that ADR now deleted, this is the
  persistence decision of record outright.
- **"Session" is no longer necessarily "wrapped in a PTY by Argo."** External Sessions are observed read-only from their transcript — no Argo-owned PTY, no steering terminal. `CONTEXT.md`'s glossary is updated to match. The PTY host is now a property of *managed* Sessions (spawn + companion plugin + steering), not of every Session.
- **Observation is unified on transcript-tailing** for all Sessions, managed and external alike. The PTY and companion-plugin channel are layered onto managed Sessions only for *control* (steering) and *CONVENTION-tier data* — never as an observation input. One Seam B, one parser; managed and external Sessions cannot drift in how they render.
- **A rail "Session" is a resume-chain** of one-or-more CLI session files (linked by `leafUuid`), not necessarily a single file — `CONTEXT.md`'s glossary is updated to match.

## Amendment · the window is a week, and a gate holds what it used to (#1000)

**What changed.** `SessionDiscovery.workingSetWindow` was 24 hours and is now **7 days**. Every
transcript the sweep admits is opened on a **bounded read of its two ends** — 64 KiB either side,
`TranscriptExcerpt` — rather than drained whole. The whole file is read **when the Session is
selected**, and the reading is **held** afterwards, bounded at twenty readings and a hundred
thousand events (`WholeReadings`).

**Why the window had to move.** A day is where the reader had left off yesterday. On the machine
this was measured on, a day was **3 transcripts** where the week held **137**, and the roster
answered "where is the rest of my work" with almost none of it. Nothing about the *meaning* of a
working set said a day; what said a day was **cost**, and cost is the thing this amendment moves
somewhere better.

**Measured, on that machine, debug build, over the real record store:**

| | files | bytes read | first row | full roster | resident |
| --- | ---: | ---: | ---: | ---: | ---: |
| a day, read whole (what shipped) | 3 | 7 MB | 192 ms | 192 ms | 70 MB |
| a week, read whole (the naive widening) | 137 | 458 MB | 6 336 ms | 8 455 ms | 947 MB |
| **a week, read at both ends (this change)** | **137** | **16 MB** | **529 ms** | **729 ms** | **80 MB** |

The bounded reading draws the **same 105 rows** as the whole one: same titles, same statuses, same
last-seen times, same order. The only fact it loses is `startedAtMs`, absent on 15 rows rather than
wrong on them, because a transcript opening on a large pasted prompt has no timed record inside its
first 64 KiB. The roster sorts on the LATEST time and renders no start, so no row moves.

**The constraint is now held by a gate, and that is strictly better.** ADR-0008's rule — *never the
full history at launch* — used to be enforced by the window being too narrow to contain much
history. That is a proxy, and a proxy nothing checks: widening the window to any span at all would
have quietly put a full-history read back on the launch path, which is exactly what the second row
of that table is. `TranscriptReadCostTests` now holds the rule itself, as counts (ADR-0028 Rule 8):

- a launch sweep opens **nothing** whole, however many transcripts the window admits;
- one bounded open reads **at most the file's two ends**, whatever the file's length;
- selecting one Session opens its file **exactly once**, however many times it is clicked and
  however many others are visited in between, up to the ceiling.

So the window is now free to be whatever span the reader actually works in, because the thing that
made it a cost decision is checked directly. A future change that puts a full drain back on the
launch path fails the build rather than being noticed as a slow launch.

**Two consequences worth stating.**

- **A row can be drawn from a reading with a hole in it**, and must not claim more than it read.
  `HubSession.transcriptExtent` carries which it is, and the three figures that are SUMS over a
  whole file — spent, cached and Subagent tokens — are withheld while it is an excerpt
  (`HubSession+Spend`). Absent is what every surface already draws as unread, so degrading down
  costs nothing; a partial total rendered as a total would be a false DIRECT. The seam itself is
  drawn in the feed rather than stitched over (`FeedMark.excerpted`).
- **The roster no longer waits for the whole set.** It used to publish nothing until every admitted
  transcript had settled; at 137 files one slow or unreadable file would be the launch. It now folds
  over what has been read (`HubJoinPublishable`), keeping the property the all-or-nothing gate was
  protecting: a row may be briefly missing, but a row already on screen never moves and is never
  taken away. A resume file is held back until the transcript it continues has been read, because
  publishing it early would let the parent's arrival absorb it.
