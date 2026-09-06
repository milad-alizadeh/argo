# Session archive sync

Argo does not sync the archived state of a Session with claude.ai, the Claude mobile app, or any
other Claude surface. Archiving in Argo is a roster gesture and stays Argo's own.

## What Argo's archive is

`SessionAnnotationStore` writes `~/Library/Application Support/Argo/sessions.json`, keyed by chain
id. The file is per-machine and never committed. `setArchived` is the only thing that clears a row
off the roster (#502, story 14), and it also reaps a landed worktree (#1398). Nothing derived from
a transcript, a branch, or a merge writes it. That makes the fact DIRECT: Argo owns it because
Argo's own user made it.

## Why sync is out of scope

Three findings, each independently sufficient.

**There is no supported way to read remote session archive state.** A plain local CLI session has
no archive at all: transcripts under `~/.claude/projects/<project>/<session-id>.jsonl` carry no
archived flag, and the CLI has no `archive` subcommand or flag. Remote Control sessions do have a
real archive that crosses devices, but nothing exposes the flag in a machine-readable form.
`claude agents --json` returns local process facts only (verified on v2.1.263: `pid`, `cwd`,
`kind`, `startedAt`, `sessionId`, `name`), with no remote session id and no archive state.
`/tasks` lists cloud sessions but only from inside an interactive session. There is no
`claude sessions list --json`.

**The private API is not a foundation.** The endpoint behind Remote Control and cloud sessions is
undocumented, unversioned, and authenticated with the user's own claude.ai credentials from the OS
keychain. Calling it from Argo means reverse-engineering a private endpoint and reading another
application's credential. Anthropic already states the posture for the neighbouring case: the
transcript JSONL "entry format is internal to Claude Code and changes between versions, so scripts
that parse these files directly can break on any release." A private HTTP API is the same bet with
no file on disk to fall back on.

**The public archive endpoint belongs to a different product.** `POST
/v1/sessions/{session_id}/archive` is real and documented, and its response carries `archived_at`,
but it is part of **Managed Agents**. It takes `X-Api-Key` with an organisation API key and the
`managed-agents-2026-04-01` beta header, and its ids are `sesn_…` alongside `agent`,
`environment_id`, `budget` and `vault_ids`. Claude Code's cloud and Remote Control sessions are
`session_…` / `cse_…` under a personal claude.ai account. Different id namespace, different auth,
different product. Pointing Argo at this endpoint finds none of the user's sessions.

## Why the workarounds are also out of scope

**Turning Remote Control on for managed Sessions is not Argo's to do.** Argo owns the PTY for every
`managed` Session, so it could start them with Remote Control on. It must not. While Remote Control
is connected the transcript is stored on Anthropic servers to keep devices in sync. That is a
consent decision belonging to the user, and Argo cannot make it as a side effect of wanting an
archive flag.

**Coverage would be partial by construction.** Only sessions with Remote Control on have a remote
side. An `external` Session that Argo discovered from transcripts has none. The roster would hold
two kinds of row that look identical and behave differently.

**The semantics do not line up.** Archiving on a phone archives the *remote session*, not the work:
the local conversation survives, and reconnecting unarchives it. "Archived on the phone" means "I
am done looking at this here", not Argo's "this work is finished, reap the worktree". An incoming
remote archive firing the reap in #1398 would destroy a worktree on a decision Argo neither made
nor witnessed.

**And the tiers would fight.** An Argo archive is DIRECT. A remote archive read over the wire is
DERIVED. Where the two disagree the model says degrade down, which means a roster that sometimes
refuses to honour the archive the user just performed in Argo.

## What would change this

An upstream capability, not a local one: a supported, machine-readable way to read remote session
state (id, title, archived) from the CLI, and ideally for archive to ride the same per-session sync
channel that rename already rides. Rename crosses both directions today (v2.1.221+), so the channel
exists and already carries one field. Archive is not on it. If that lands, reopen this.

Modelling cloud Sessions is a separate question. `docs/domain/l2-session.md` has only
`managed | external`, both transcript-backed, and adding a cloud posture is worth deciding on its
own merits. It would not solve this: it hits the same auth wall.

## Prior requests

- #1519: "Archiving a Session in Argo does not archive it on Claude's own surfaces"
