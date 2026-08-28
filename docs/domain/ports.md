## Ports

Argo's two adapter ports — how **Argo itself** reads external truth. **Access is OAuth + the
provider's HTTP API, not the `gh` CLI** (tokens in the OS keychain; polled, since a desktop app
receives no webhooks). `gh` remains how *agents* operate the repo — a different layer.

A port names the *kind* of external truth; an **Account** is who Argo is when it reads, and a
**Binding** is which Account one Project reads through. Authorizing is Account-level and done
once per identity per machine; choosing is Binding-level and done per Project — so a second
Project on an already-authorized provider **binds without a second OAuth round-trip**.

- **Work Item provider** — sources intent. GitHub Issues / Linear for v1; pluggable. The read
  contract is children **in author order** (native on every provider); per ticket the verbatim
  status word, open/closed, closure kind, assignee, priority and labels; `blockedBy` **verified
  per-blocker**; and comments as `{ id, text, revisedAt }`, flat and creation-ordered.

  An adapter declares its gaps two ways — **a static capability descriptor** for what must be
  known before any read (`canAssign`, `canComment`,
  `closureKind: native | configured | none`), and **per-fact `unknown`** for a value it reads
  but cannot establish. Capabilities decide whether an affordance **exists**; `unknown` decides
  what a present affordance **shows**.

  The port is **read-write**. The write half speaks **canonical intents**, never provider-shaped
  setters (#167, #257): `create` · `updateFields` · `transitionTo` · `addBlockedBy` /
  `removeBlockedBy` · `setParent` / `removeParent` · labels · `setPriority` · `close(reason)` /
  `reopen`. `transitionTo` names a **canonical state** — `todo · in-progress · in-review · done
  · closed` — and the adapter resolves it to the provider's own mechanism; a state the provider
  cannot express is **declared unavailable and refused**, never written as the nearest one it
  holds. Status stays **purely provider-sourced**: a running Session does not make a ticket
  in-progress and an open PR does not make it in-review.

  Writes are **pessimistic at the seam** — the provider's own answer becomes the new truth
  without waiting for the next poll — and **never retried**, because auto-retrying a transition
  risks double-applying against a workflow whose legality is per-provider. A refusal carries the
  provider's **verbatim reason**; only a failure that never reached the provider is a connection
  fault. **Every fact the adapter reads it must also be able to write**, by whatever mechanism it
  read it — a control offered against a fact it cannot change lies about which of the two is
  authoritative.

  **Two adapters fill it** (#371), and where they disagree is where the port earns its keep.
  GitHub Issues carries no priority field, so its adapter reads and writes one off a **scoped
  label**; Linear has a real priority field with four fixed rungs, so its adapter turns the
  canonical verbatim *word* back into a rung and refuses a word Linear has no rung for. On
  edges: Linear serves relations **with** the issue, so an empty list is the provider saying
  there is nothing in the way (`blockedBy == []`), where GitHub serves only a summary and its
  absence is UNKNOWN (`blockedBy == nil`). And on workflow: GitHub is a bare tracker reaching
  `todo · done · closed`, where Linear expresses `in-progress` natively — but **not**
  `in-review`, which Linear has no state *category* for. Reading it off a column a team happened
  to name "In Review" would derive a canonical state from typography, which is a false DIRECT.

  Out of scope: comments, assignee, hard-delete, and any mapping-editor UI.
- **Code host** — sources Delivery truth (PR/CI/review/merge). GitHub for v1. One GitHub
  Account can feed **both** ports **and fails as one** — but only within that Account; a second
  GitHub Account is a separate grant with its own failure. Linear is Work-Item-only.
- **MCP server** — *distinct from the ports above*: tool/context providers the **observed
  session** connects to. An observable Session attribute, **not** an Argo port. Deferred for v1.
