# 0041 · Compaction is observed through a user hook

Status: accepted · 2026-09-15

> **Superseded by ADR-0047 · 2026-09-21:** adapters read compaction from vendor events and history.
> Argo no longer installs a user-level compaction hook or reads transcript and rollout boundaries.

Amends ADR-0024, which installs Argo's hooks only in the companion plugin of a Session that Argo
starts.

## Context

Claude Code writes nothing to a transcript while it compacts. A measured auto-compact of 217k
tokens ran for 72 seconds. The transcript got no record between the last tool result and the
`compact_boundary` at the end. The per-process status file in `~/.claude/sessions/` reads only
`busy`, `idle` or `waiting`. The Feed therefore showed nothing for the whole compaction.

Argo already showed progress for one case only: a `managed` Session where the person pressed
Argo's Compact button. An auto-compact, a `/compact` typed into the terminal, and every `external`
Session showed nothing.

## Decision

At launch, Argo adds one `PreCompact` command hook to the user settings file,
`~/.claude/settings.json`. Every Claude Session on the machine runs it, so it covers `external`
Sessions too. The hook writes its input, which names the Session, to a start file in
`~/.claude/argo-compactions/`. The write time of the file is the start of the compaction.

The Claude reader shows a Session as compacting while its start file is live. The compact
boundary ends the compaction. A message after the start also ends it, because the person
interrupted the compaction. A compaction older than 30 minutes belongs to a Session that died.
The reader deletes its start file. For a `managed` Session, the start file also starts the
reading of the percentage that the terminal paints, and the same rule ends that reading.

Codex gets no hook. A `managed` Codex Session does not need one: `codex app-server` sends
`item/started` for a `contextCompaction` item when a compaction starts, for a requested and an
automatic compaction alike, and the matching `item/completed` ends it. Codex gives no percentage,
so the Feed shows only the spinner and the elapsed time. An `external` Codex Session shows nothing
while it compacts. Codex writes nothing to a rollout during a compaction: a measured auto-compact
ran for 45 seconds with no record. The top-level `compacted` record at the end draws the
compaction divider.

## Why

The hook is the only live signal that Claude Code gives. The folder is under home and not under
`userData`, so a dev instance and the installed app share one hook entry.

## Consequences

- Argo writes a file that the person owns. The install keeps every other key and hook, writes
  through a symlink, keeps the file mode, and replaces an older Argo entry. The trailing
  `# argo-compaction-start` comment identifies that entry. If the file is not valid JSON, Argo
  does not change it and logs a warning. If the settings file is a link to a file that is gone,
  Argo does not change it.
- The install reads and writes the settings file without a lock. If Claude Code writes the file
  at the same moment, one of the two edits is lost.
- The hook always exits 0 and reads all of its input, so a failed write cannot block a compaction.
- The hook stays in the settings file after Argo is removed. It then only leaves small files in
  `~/.claude/argo-compactions/`.
- A proof run and a PTY acceptance run do not install the hook and do not read start files.
- No live-CLI test proves that Claude Code runs this hook. The tests run the hook command in
  `/bin/sh` and read fixture transcripts. ADR-0024 covers its own hooks with a live-CLI test.
- Argo installs nothing in `~/.codex/`. The same hook in `~/.codex/hooks.json` would cover
  `external` Codex Sessions, but Codex runs a new user hook only after the person trusts it in its
  `/hooks` view, and it shows a warning until then.
- `external` Sessions still raise no Permission. This hook observes. It does not drive.
