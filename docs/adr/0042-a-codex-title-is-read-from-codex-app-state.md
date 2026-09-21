# 0042 · A Codex title is read from Codex app state

Status: accepted · 2026-09-15

> **Superseded by ADR-0047 · 2026-09-21:** Codex titles come from app-server. Argo no longer reads
> `state_5.sqlite` or any other private Codex schema.

Reopens closed #435, which said that a Codex title from SQLite needs its own ADR.

## Context

Codex writes no title record to a rollout (the `.jsonl` transcript of one thread). The Roster
therefore titled every Codex Session by its first user message. Threads that the Codex voice
session opens with the `codex_app.create_thread` tool have no user message of their own. Their
only user message holds text that Codex injects: `<recommended_plugins>`, the repository's
`# AGENTS.md instructions for …` block, and `<environment_context>`. On 2026-09-15 nearly every
recent Codex row read `# AGENTS.md instructions for …`, and the person thought that Argo showed no
Codex Sessions at all.

Codex Desktop names each thread itself. It keeps the name in its own app state, the SQLite file
`~/.codex/state_5.sqlite`, table `threads`, column `name`. On 2026-09-15, 110 of the 315 threads
updated in the last two days had a name. `threads.title` is only a copy of the first user message.

## Decision

The Codex adapter titles a Codex Session in this order:

1. The `threads.name` value, if it is not empty. Its title source is `summarised`.
2. The first prompt, with the injected text removed. Its title source is `first-prompt`.

For the second step, the adapter already hides the `AGENTS.md` block, `<recommended_plugins>`,
`<environment_context>` and the `# Files mentioned by the user:` list (#2234). A thread that
`create_thread` opened has no prompt left after that. It takes its prompt from the `<input>` of the
`<codex_delegation>` that the tool returns into it. The Feed draws the same prompt, so the thread
opens with its request and not with an injected block.

Argo opens the state file read-only through `node:sqlite`, which Electron 44 ships with Node
24.20. It keeps the names it read. A discovery pass opens the file only when the file or its
`-wal` file has a new modification time or size, or when the pass finds a thread that Argo did
not ask about yet. The read does not wait for a lock. If the file is missing, locked, or has a
different schema, the read names nothing new. A name that Argo already has stays, and a thread
without one falls back to the prompt. The next pass asks again. Argo never writes to the file.

The state file sits next to the `sessions/` folder. The adapter finds it from the transcripts
root, so a proof that points `ARGO_CODEX_TRANSCRIPTS` at a fixture folder never reads the real file.

## Why

The name is what the Codex app shows, so the person sees the same name in both apps. The source is
`summarised` and not `custom` because Codex makes most names itself. A `custom` title makes Argo
ask before Connect a Ticket replaces it, and a name that cost the person nothing does not need that
question.

## Consequences

- The `threads` table is private Codex app state with no published schema. A Codex update can
  rename the column or the file. The title then falls back to the prompt without an error.
- A rename through `thread/name/set`, from Argo or from Codex, also writes `threads.name`. After a
  restart it reads as `summarised`, so Connect a Ticket replaces it without asking.
- The read is synchronous in the main process. It measured 5 ms on the real file, and a pass
  with no change does not open the file. On 2026-09-15, with Codex Desktop running, 23,811
  reads with no lock wait were never refused while Codex committed 67 times. A reader of a WAL
  database does not wait for the writer.
- Bun, which runs the unit tests, has no `node:sqlite`. The unit tests give the same reader a
  `bun:sqlite` store, so the query, the schema check, the cache and the fallback run for real.
  The packaged Session proof writes a store beside its fixture rollouts, and the packaged app
  must then show the name. That proof covers the `node:sqlite` open.
- A thread with no name and no prompt, such as a voice chat, still shows its id.
