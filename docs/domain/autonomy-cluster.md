## Autonomy cluster (cross-cutting)

- **Mode** — the **Session's** *standing* autonomy stance (root-Agent fact, not per-Subagent): a
  four-rung ladder **`Read Only | Plan | Code | Auto`**, plus **`unknown`** when unobservable.
  DIRECT for managed, tier-gated for external. Each rung is a **boundary**, not a prompt
  frequency: inside it the agent acts, at it Permission fires (ADR-0025).
  - **Read Only** — no writes. Asks before any edit, command, or network reach.
  - **Plan** — Read Only's boundary carrying a deliverable: the agent proposes, then hands off.
    Same permission level as Read Only, different **intent**. This is the one place on the ladder
    where two rungs share a boundary, and it is deliberate rather than an oversight.
  - **Code** — writes and runs inside the **Workspace**, and asks to leave it.
  - **Auto** — no boundary, asks nothing.

  A CLI value with no exact rung renders as the **nearest rung marked `≈`**, never `unknown` —
  see the Honesty tier section. The `Plan` **mode** value ≠ the `Plan` **entity** (L3 to-do list)
  — distinct senses, never in one clause.
- **Permission** — a *per-action* prompt the **agent** raises ("may I run this tool?"; options
  `allow_once · allow_always · reject_once · reject_always`). DIRECT, managed-only; drives the
  `permission` session-status.
- **Standing allow** — one **tool** a Session has stopped raising Permissions for, made by
  answering a Permission with *always*. DIRECT and managed-only, keyed by the CLI's tool name
  verbatim, and **scoped to the Session's claim**: it covers every call to that tool, ends when
  it is revoked or the Session does, and **survives no restart** — the per-claim gate that would
  honour it dies with the PTY. It is **rendered wherever it holds** and **revocable without
  ending the Session**; a grant nobody can find or take back is the thing the Permission prompt
  exists to prevent (#572). The **Gate**'s per-tool sibling on the Session, as Gate is Argo's own
  policy on a Delivery step — both are Argo's automation of its own asking, not an agent prompt.
- **Permission expiry** — a Permission that ended because **Argo's own patience ran out**, not
  because anyone answered it (#573). DIRECT and managed-only: the gate's clock is deliberately
  **shorter than the hook's**, so the call is refused by Argo rather than by a hook being killed —
  which is what makes the cause knowable at all. Rendered as a mark on the Session's reading saying
  *denied* **and** *unanswered*, because either word alone is a different and untrue claim. A prompt
  that goes because the user cancelled its turn produces none: that is the user answering, and it
  is indistinguishable from a hook simply going, so both stay silent under the degrade-down rule.
  **Survives no restart**, for the reason a Standing allow does not — the gate that would have
  observed it dies with the PTY, so an Argo restarting under a live CLI records nothing and the
  Session demotes to orphaned instead.
- **Gate** — **Argo's own** policy on automating *Delivery* steps (create-PR, merge,
  push-after-PR), each `ask | auto`. Argo-owned automation, **not** an agent prompt — a
  different actor and axis from Permission.
