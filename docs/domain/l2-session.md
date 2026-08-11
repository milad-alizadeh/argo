## L2 · Session

- **Session** — the observation unit: one **logical resume-chain**, keyed by a stable chain id
  (one-or-more transcript files stitched by `leafUuid`). The only stored classification is
  **`managed | external`** — no kinds (ADR-0013). `managed` = Argo spawned it, owns the PTY,
  companion plugin loaded → drivable + carries CONVENTION-tier facts. `external` = discovered
  from transcripts, read-only, no PTY. **All sessions are observed** (transcript-tailing is the
  floor); managed is *external + PTY steering + CONVENTION channel* layered on top. v1 ranks
  external lower (read-only awareness), ships managed-first.

  **Managed-ness is not durable across an Argo restart**: the PTY/steering channel dies with the
  owning process and cannot be re-adopted, so a `managed` session whose owner is gone demotes to
  **orphaned** — observation-only, steering unrecoverable (CONVENTION may re-establish only if
  the plugin re-dials CLI-side). Orphaned is a third posture of the `managed | external` axis,
  not a fourth stored kind.

  A Session **is the root Agent** (`parentId: null`). Key attributes: **`cli`**
  (`claude | codex | …`), **`cwd`** (**DIRECT for managed / DERIVED for external** — the root of
  every L1-triangle derivation and of external liveness matching).

- **Transcript file** — the *physical* per-file CLI record (owned by the CLI). One Session
  stitches one or more. Never itself called a "Session."

- **Session status** — a DERIVED rollup on the Session:
  - **running** — a Turn is in progress.
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

  A **seventh value, `unknown`**, is the degrade-down rule made reachable: a Session whose record
  carries no Turn boundary at all is `unknown`, not `idle` — nothing observed is a different claim
  from observed to be quiet.

- **Session Mode** — the Session's *standing autonomy stance*; defined once in the Autonomy
  cluster below. A Session (root-Agent) fact, not per-Subagent. DIRECT for managed, tier-gated
  for external.

- **`SessionFacts` — dissolved, not an entity.** git facts (`dirty/unpushed/headSha`) →
  **Workspace**; code-host facts (`pr/ci/review`) → **Delivery**; liveness/mode → **Session
  status/Mode**.
