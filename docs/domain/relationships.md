## Relationships (the whole graph)

- **Project** `1—N` **Session**, `1—N` **Delivery**; holds **`0..1` Binding per port** (Work
  Item, Code host), which is what scopes the providers it reads.
- **Account** `0—N` **Binding**, across any number of Projects; a **Binding** names exactly
  **one Account** and **one port**. A provider has `0—N` **Accounts** on this machine, so
  Account is the level a grant, a token and a revocation all sit at, and Binding is the level a
  provider *choice* and its health sit at.
- **L1 triangle** (all optional): **Session—Ticket** (branchless-fallback assertion, else
  derived), **Session—Delivery** (**`0..1` at a time**, N over a resume chain),
  **Delivery—Ticket** (join precedence, **user-assertable when unlinked**). Many-to-many
  holds only *across time*; at any instant a Session is on at most one branch → one Delivery.
- **Agent tree**: **Session** *is* the root **Agent** (`parentId: null`); an **Agent** `0..N`
  child **Subagent** (recursive via `parentId`). Each **Agent** owns **`0..1` Workspace** (else
  inherits its parent's) and attaches **`0..1` Preview** — both node-scoped (ADR-0010); Preview
  is additionally a **cockpit-level singleton**. A **Workspace** holds `0—N` **File**.
- **Inside an Agent**: `1—N` **Turn**; each **Turn** `0—N` **Tool Call**, `0—N` **Message** and
  `0—N` **Thought** (one ordered prose sequence, the two kinds distinct within it), `0..1` its
  opening **prompt**, and `0..1` **Usage**, rolled up to a **Session**-level Usage; `0—N`
  **Compaction** markers punctuate the Turn sequence. The **Plan** is **not** on this line: a
  **Session** holds `0..1` **Plan** (the live list), and a **Turn** carries `0..1` **snapshot**
  of it (ADR-0020).
- **Delivery detail**: **Delivery** `1—1` **Diff**, `0—N` **Review** (`0—N` **Finding**), `0—N`
  **Check**, and `1—N` **Gate** (per automatable step).
- **Session** `0—N` **Outcome** (the `produces` link; each refs a typed target —
  **Diff/Delivery** | **Ticket** | **artifact**). External sessions: none in v1.
- **Session** `0..1` **session Terminal** (live PTY, managed-only) and `0—N` **MCP server**
  (observed attribute, deferred); a **Workspace** additionally has `0—N` agent-less **scratch
  Terminal**.
- **Person** (`me | other`) authors a **Review** and owns the teammate-PR distinction on a
  **Delivery**; drives "needs-you" attention.
- **Honesty tier** — an attribute on *every* rendered fact (DIRECT / DERIVED / CONVENTION), not
  an entity.
- **Autonomy** — **Mode** (standing stance) + **Permission** (per-action prompt) + `0—N`
  **Standing allow** (one per tool that has stopped asking) + `0—N` **Permission expiry** (one per
  Permission Argo's own clock refused) sit on the **Session**; **Gate** (delivery automation) sits
  on the **Delivery**. Distinct axes.
