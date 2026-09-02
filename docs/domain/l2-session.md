## L2 · Session

- **Session** — the observation unit: one **logical resume-chain**, keyed by a stable chain id
  (one-or-more transcript files stitched by `leafUuid`, or — where a relocation left no shared
  record — by the origin `session_id` they all name, #735). The only stored classification is
  **`managed | external`** — no kinds (ADR-0013). `managed` = Argo spawned it, owns the PTY,
  companion plugin loaded → drivable + carries CONVENTION-tier facts. `external` = discovered
  from transcripts, read-only, no PTY. **All sessions are observed** (transcript-tailing is the
  floor); managed is *external + PTY steering + CONVENTION channel* layered on top. v1 ranks
  external lower (read-only awareness), ships managed-first.

  **A PTY is not durable across an Argo restart; a Session is** (ADR-0026). The PTY/steering
  channel dies with the owning process and cannot be re-adopted, so a `managed` session whose owner
  is gone demotes to **orphaned** — read-only *now*, because there is no live channel. It is not
  read-only forever: a Session is a resume-chain, and `claude --resume` continues one in a fresh
  process, so the channel is **re-opened rather than re-adopted**. Selecting an orphaned Session
  resumes it and it is `managed` again; CONVENTION comes back with the plugin the resume loads.
  Orphaned is a third posture of the `managed | external` axis, not a fourth stored kind.

  Telling `orphaned` from `external` after a relaunch needs a durable record of past ownership —
  Session id and the window Argo held it for, per-machine and never committed. That record is not
  a roster: the roster is still rebuilt from the transcripts every launch (ADR-0004, ADR-0008).

  A Session **is the root Agent** (`parentId: null`). Key attributes: **`cli`**
  (`claude | codex | …`), **`cwd`** (**DIRECT for managed / DERIVED for external** — the root of
  every L1-triangle derivation and of external liveness matching).

- **Transcript file** — the *physical* per-file CLI record (owned by the CLI). One Session
  stitches one or more. Never itself called a "Session."

  **A relocation opens one** (#735). `EnterWorktree` closes the file and opens a fresh one under
  the worktree's own project directory, sharing no `uuid`, `requestId`, `messageId` or `promptId`
  with what came before. The only shared key is the snake_case `session_id` every message-bearing
  record carries, which names the chain's **origin** rather than its predecessor — so it groups a
  chain, and `leafUuid` still owns the immediate link where there is one. The relocated half is the
  live one, so the merged Session's `cwd` and `branch` are the worktree's.

  **Or it MOVES one** (#770), which is the shape seen in practice. The file keeps its uuid and is
  moved into the worktree's own project directory, so one Session is one uuid under two paths and
  the path it left is never written to again. A Session is KEYED by that path — by the roster and
  by the ownership ledger both — so ownership follows the file: the claim that named the transcript
  re-keys to the new path. A claim that stayed behind renders a Session Argo is steering right now
  as one it never spawned, which is #942.

- **Session status** — a DERIVED rollup on the Session, with one DIRECT value beside it:
  - **starting** — Argo started the process and it has not written to the PTY yet. **DIRECT and
    managed-only**, and the only value read off no record at all: the CLI writes none until its
    first prompt. It ends on the child's FIRST BYTES — witnessed on a descriptor Argo owns — and
    never on a clock or on "nothing written yet", which would stand over a booted agent for the
    rest of the window's life (#587). First byte is the honest FLOOR: a CLI that prints a banner
    before it is ready ends the claim early, which under-reports the boot rather than over-claiming
    it, and anything stricter would mean recognising a prompt in a TUI's own bytes — a guess in an
    observation's clothes.
  - **running** — a Turn is in progress. **DERIVED**, except for a Turn ARGO ITSELF submitted to a
    managed Session, which is **DIRECT**: Argo wrote the words to a PTY it owns, so no liveness poll
    and no cwd match has to corroborate that a Turn opened (#1048). Tier-gated by posture the way
    `asking` already is, and for the same reason — the channel exists on one posture only. That
    claim ends where Argo can WITNESS it ending, never on a clock: the record saying the Turn
    ended, the delivery watch reporting a Turn the CLI never heard (#682), or the process behind
    the PTY going. A record that grows without opening a Turn ends it too, which under-reports the
    Turn rather than standing on it. An **external** Session reaches none of this: the submission
    is filed against a claim, and a Session Argo holds no claim on is one it cannot type at.
  - **permission** — blocked on an agent `request_permission` prompt.
  - **asking** — blocked on a structured `AskUserQuestion`.
  - **idle** — Turn ended `end_turn`, or no live signal; **includes an agent's free-form
    question** (indistinguishable from idle in the record — never fabricated as `asking`).
  - **stopped** — Turn ended on `max_tokens · max_turn_requests · refusal`.
  - **ended** — session terminated (`cancelled` or process exit).

  Honesty-gated: `permission` is DIRECT, **managed-only**. `asking` is **CONVENTION for managed,
  DERIVED for external** — but only when "pending" is **confirmable** from the record (a
  resolved question reads as `idle`). `stopped` needs a stop-reason an external transcript may
  not carry — where the record **does** carry one it is read DERIVED and rendered; where it
  carries none, or one outside the vocabulary, the status is **`unknown`**, never the nearest
  guess. **External floors at `running · asking? · idle · ended`**; managed `permission` collapses
  to `idle` when observed externally.

  `starting` is unreachable for every other posture, and for a `managed` Session it is unreachable
  once anything at all has spoken: a Permission, a question, a drive report or a companion report
  is itself proof the CLI is up, and each of them outranks it.

  A **seventh value, `unknown`**, is the degrade-down rule made reachable: a Session whose record
  carries no Turn boundary at all is `unknown`, not `idle` — nothing observed is a different claim
  from observed to be quiet.

- **Session Mode** — the Session's *standing autonomy stance*; defined once in the Autonomy
  cluster below. A Session (root-Agent) fact, not per-Subagent. DIRECT for managed, tier-gated
  for external.

- **`SessionFacts` — dissolved, not an entity.** git facts (`dirty/unpushed/headSha`) →
  **Workspace**; code-host facts (`pr/ci/review`) → **Delivery**; liveness/mode → **Session
  status/Mode**.
