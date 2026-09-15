# 0041 · Compaction is observed through a user hook

Status: accepted · 2026-09-15

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
Sessions too. The hook writes its input, which names the Session, to a marker file in
`~/.claude/argo-compactions/`. The write time of the file is the start of the compaction.

The Claude reader shows a Session as compacting while its marker is live. The first record after
the start ends the compaction. That record is the compact boundary, or a reply when the person
interrupted the compaction. A marker older than 30 minutes belongs to a Session that died, and
the reader deletes it. For a `managed` Session, the marker also starts the reading of the
percentage that the terminal paints.

## Why

The hook is the only live signal that Claude Code gives. The folder is under home and not under
`userData`, so a dev instance and the installed app share one hook entry.

## Consequences

- Argo writes a file that the person owns. The install keeps every other key and hook, writes
  through a symlink, keeps the file mode, and replaces an older Argo entry. The trailing
  `# argo-compaction-marker` comment identifies that entry. If the file is not valid JSON, Argo
  does not change it and logs a warning.
- The hook always exits 0 and reads all of its input, so a failed write cannot block a compaction.
- The hook stays in the settings file after Argo is removed. It then only leaves small files in
  `~/.claude/argo-compactions/`.
- A proof run does not install the hook and does not read markers.
- `external` Sessions still raise no Permission. This hook observes. It does not drive.
