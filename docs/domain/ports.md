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
- **Code host** — sources Delivery truth (PR/CI/review/merge). GitHub for v1. One GitHub
  Account can feed **both** ports **and fails as one** — but only within that Account; a second
  GitHub Account is a separate grant with its own failure. Linear is Work-Item-only.
- **MCP server** — *distinct from the ports above*: tool/context providers the **observed
  session** connects to. An observable Session attribute, **not** an Argo port. Deferred for v1.
