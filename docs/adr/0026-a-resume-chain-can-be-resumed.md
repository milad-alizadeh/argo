# 0026 · A resume-chain can be resumed; orphaned is not the end of a Session

Status: accepted · 2026-08-11

Supersedes one clause of `docs/domain/l2-session.md`: *"the PTY/steering channel dies with the
owning process and cannot be re-adopted, so a `managed` session whose owner is gone demotes to
**orphaned** — observation-only, steering unrecoverable."* The first half stands. The second is
withdrawn. Binding on #10 and on `SessionOwnership`.

## Context

Argo spawns a `claude` in a PTY it owns. That ownership is held in memory for the life of one Argo
process and written nowhere, so the model drew a conclusion from it: managed-ness is not durable,
`orphaned` is permanent, and a Session Argo lost is observation-only forever.

Two things were wrong with that, and they compounded.

**The conclusion does not follow from the premise.** The PTY is not the Session. `CONTEXT.md` L2
defines a Session as *one logical resume-chain*, keyed by a chain id that stitches transcript files
by `leafUuid`. `claude --resume <session-id>` continues that chain in a fresh process. The steering
channel is therefore recoverable — it just has to be re-**opened** rather than re-**adopted**. A
resume-chain that cannot be resumed is not one.

**Nothing on disk recorded ownership, so grading could not even say `orphaned`.** After a relaunch
no claim covers any Session, and the grading returns `external` when no claim covers one. `external`
means *never Argo's*, which is false about a Session Argo itself spawned. Two consequences were
visible in the app: the composer vanished, because it is drawn only for `managed`; and a Session
Argo started was labelled as somebody else's.

## Decision

**`orphaned` means the PTY is gone and the chain can be continued.** It is still read-only *now* —
there is no live channel — but it is not terminal.

Three things follow.

**A durable ownership ledger.** Per-machine, never committed, keyed by Session id, holding the
window Argo owned each Session for and who owned it. Written when a claim binds a Session and when
it is released. It answers two questions nothing else can — has any Argo held this Session's PTY,
and is one holding it right now — and grading and the resume gate have no other way to ask them.
It is emphatically **not a roster**: it stores no titles, no ordering, no session content, and the
roster is still rebuilt from the transcripts every launch, which is what ADR-0004 and ADR-0008
require.

The owner is a process id **and** an id for the registry inside it, because one Argo process runs
many cockpit windows with a registry each: on the pid alone two windows read as one owner, and the
second would happily resume what the first is steering.

**Resume is the third caller of one spawn path.** `SessionSeed` gains an optional Session id to
continue; the per-CLI argv builder that emits `--permission-mode` also emits `--resume`. A New
Session, a handoff and a resume are one path with three seeds.

**Selection is the trigger, and it is lazy.** Picking a Session Argo cannot steer resumes it — no
button and no prompt, because the click is the intent: the user selected the row in order to use
it. Launch resumes nothing on its own, and a selection the roster made for itself resumes nothing,
so N Sessions never become N agent processes. A Session already live spawns nothing, and two clicks
inside one `claude` startup spawn one agent.

Because the Session id is known **before** the spawn, a resume's claim is bound to that id directly
rather than matched back by folder and start time. That is strictly better than a cold spawn's
binding and sidesteps the guessing #363 and #364 describe.

## Why

- The domain model already said the right thing and the implementation note contradicted it. A
  Session is a resume-chain; the PTY is one process serving one link of it. Conflating the two cost
  the user their conversation every time they quit the app.
- The alternative — re-adopting the original process — is genuinely impossible, and recording
  *that* is worth keeping. Nothing here tries it.
- The ledger is the smallest durable fact that makes the grading honest. Anything larger would be a
  roster on disk, which the persistence ADRs forbid; anything smaller cannot tell `orphaned` from
  `external` after a relaunch.

## Consequences

- **A resume replays the chain's context, so it costs tokens and time.** Selection is where that is
  spent. A narrower trigger — draw the composer on selection, spawn on the first turn sent — keeps
  the same user gesture and was considered; selection is the specified trigger and stands. If
  browsing the roster turns out to be expensive in practice, that is the change to make.
- **`external` Sessions are still not resumable.** One Argo never started belongs to whoever did,
  and taking it over is a separate decision.
- **Codex is out.** One CLI is what the app can honestly launch (ADR-0024).
- **A resume continues the chain's LATEST link, not its root.** The Session's own id is the root's,
  and resuming that would fork the chain where its first continuation left. The tip's transcript
  filename is the id `--resume` is given.
- **A ledger that cannot be written costs the next launch, not this one.** Grading is right until
  the app quits, and then a Session it owned reads `external` again — the behaviour Argo had before
  this file existed.
- **An open window whose owner is still running is another window's Session, and a resume is
  refused.** An open window whose owner is gone is the ordinary orphan — that Argo was killed
  before it could close it — and resumes normally.
- **The ledger only grows.** One small entry per Session Argo has ever owned, and nothing prunes
  it: a transcript that has been deleted leaves its window behind. Left as is because the entry is
  a few dozen bytes and there is no honest signal that a Session is gone for good; if the file
  ever matters, prune on the transcript's absence rather than on age.
- **A resume that fails to launch leaves the Session `orphaned` and says why.** It must never draw
  a composer that cannot send, which is #546's rule applied unchanged.
