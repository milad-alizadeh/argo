# Codex app-server roster and SQLite contention

## Finding

There is a documented `thread/list` option that avoids Codex's default JSONL repair scan: pass `useStateDbOnly: true`. The app-server docs say this returns results from its state database without scanning JSONL thread logs to repair metadata. Pair it with cursor pagination, a small `limit`, and the `sourceKinds` the roster needs. This keeps Argo on the app-server API and avoids Argo reading rollout files.

This option does not bypass SQLite. `thread/list` still needs Codex's state database, and the app-server still initializes its local databases. It therefore cannot guarantee a response while another Codex process holds a conflicting lock. The opened report for issue [#20213](https://github.com/openai/codex/issues/20213) is still open and has no maintainer response or supported lock-recovery setting. Its claims about `logs_2.sqlite`, missing busy retries, and improvement after clearing the log table are reporter evidence, not an upstream-confirmed diagnosis.

The current upstream [`insert_logs`](https://github.com/openai/codex/blob/main/codex-rs/state/src/runtime/logs.rs#L2200) begins a SQLite transaction and propagates a begin error; there is no retry loop in that method. That source supports the reported risk for log writes, but it does not prove that `thread/list` itself is blocked by `logs_2.sqlite`. A logs database lock can instead prevent app-server startup because the state runtime initializes the log store as part of startup.

## What Argo should do

- Call `thread/list` with `useStateDbOnly: true`, `limit`, and cursor pagination. Do not add transcript or rollout file discovery as a roster fallback; that conflicts with [ADR-0047](../adr/0047-vendor-protocols-drive-sessions-and-owned-workflows-use-xstate.md), which assigns Codex session history to the vendor protocol.
- Keep Claude roster loading independent. If Codex app-server fails, retain Claude rows and show one Codex load error. Retry Codex separately; do not hold the merged roster or scroll rendering on its response.
- If the error is a live SQLite lock, the only low-risk user workaround supported by the reports is to quit other Codex clients or app-server owners, then retry. A second app-server can add another reader/writer and is not a lock workaround.
- Do not automatically delete, truncate, or vacuum Codex databases. Issue #20213 reports that deleting rows from `logs_2.sqlite` helped one reporter, but that operation clears Codex diagnostic logs and does not repair `state_5.sqlite` contention. It is not a documented recovery procedure. If a database is corrupt or startup still fails after all Codex processes are closed, preserve a backup and use a Codex-provided recovery path or support guidance.

## Related performance reports

These are separate from SQLite lock contention. Issue [#22411](https://github.com/openai/codex/issues/22411) reports that `thread/list` scans session files and proposes lazy metadata loading; its suggested workaround deletes old session files, which is destructive and should not be used. Issue [#45246](https://github.com/openai/codex/issues/45246) reports list latency rising with thousands of unarchived threads. It describes archiving old threads as a workaround, but does not establish a lock fix. The official API's `useStateDbOnly` option is the relevant non-destructive way to skip JSONL repair scans; it does not promise constant-time behavior as the database grows.

## Sources

- [Codex app-server: `thread/list` pagination and `useStateDbOnly`](https://developers.openai.com/codex/app-server/#list-threads-with-pagination--filters)
- [openai/codex issue #20213: concurrent SQLite contention](https://github.com/openai/codex/issues/20213)
- [openai/codex source: `StateRuntime::insert_logs`](https://github.com/openai/codex/blob/main/codex-rs/state/src/runtime/logs.rs#L2200)
- [openai/codex issue #22411: reported session-file scan in `thread/list`](https://github.com/openai/codex/issues/22411)
- [openai/codex issue #45246: list latency with many unarchived threads](https://github.com/openai/codex/issues/45246)
- [ADR-0047: vendor protocols drive sessions](../adr/0047-vendor-protocols-drive-sessions-and-owned-workflows-use-xstate.md)
