# 0040 · Origin does not gate a resume

Status: accepted · 2026-09-14

Supersedes the `never-owned` standing and the "`external` Sessions are still not resumable"
consequence of ADR-0026. Binding on #10 and on `SessionOwnership`.

## Context

ADR-0026's ownership ledger graded a Session on two axes at once: whether *this* Argo currently
holds its live channel, and whether *any* Argo ever started it. The second axis produced a
`never-owned` standing that refused to resume a Session Argo did not spawn, on the reasoning that
"one Argo never started belongs to whoever did."

That reasoning does not hold up. Argo already reads any transcript on disk regardless of who wrote
it (`external` posture, ADR-0004/ADR-0008), and `claude --resume` / a fresh Codex thread does not
care who ran the previous process. The only fact that ever mattered for driving a Session is
whether a live channel to it exists and who holds it *right now* — origin is a fact about the
past that the resume path never reads.

## Decision

**The ownership ledger grades on one axis: who currently holds the live channel.** Standing is
`resumable | held-here | held-elsewhere` — never-owned and orphaned collapse into `resumable`,
because a Session's origin does not change what Argo can do with it. A Session graded
`held-elsewhere` is the one case Send refuses (another live window on this machine holds the
channel); everything else resumes.

**A Session another process runs live is locked.** The ledger is one reading of that. Each CLI
adapter adds its own from what the CLI records: a live `claude` process names its Session in
`~/.claude/sessions/<pid>.json`, and a Codex rollout whose newest Turn opened and did not end,
written in the last 30 minutes, is running elsewhere. A locked row shows a lock in the Roster
and no composer. A `managed` row is never locked, and an `external` Session that no process runs
stays resumable.

**Posture stays binary.** `docs/domain/l2-session.md`'s `managed | external` axis gains no third
value. A Session Argo drove before, then lost across a restart, reads `external` exactly like one
it never touched — the Roster shows no distinction, because there is none left to show. Whether a
particular `external` Session is locked is a live fact the Roster reads on each pass, not a
posture.

Both CLI adapters carry the same shape: Claude already read a resume's target `cwd` off the
transcript, independent of the ledger; Codex's ledger is rewritten to match (it previously stored
`cwd` in the ledger entry itself, which is what let the old `never-owned` grading arise).

## Why

- The user's own words: "we just look at which sessions we currently have a PTY for, those can be
  written into; for Claude, for Codex it's similar." Origin was never load-bearing for that
  question.
- A durable per-machine record of "did any Argo ever start this" is strictly more state than the
  question needs, and it is what produced the wrong refusal in the first place.

## Consequences

- **A Session another process runs live is locked**: another Argo window (`held-elsewhere`), a
  `claude` in a terminal or another app, or a Codex Turn another client is running. None of these
  readings is about origin.
- **A Session another Codex client or a bare terminal started is now resumable from Argo**, the
  same as any Session Argo lost across a restart. Taking it over is no longer a separate decision.
- **The Claude and Codex ownership ledgers are now the same shape**: `bind(sessionId)`,
  `release(sessionId)`, `standing(sessionId)`. Neither stores `cwd`; each CLI adapter resolves a
  resume's working directory from the transcript itself.
