## L1 · Organisation entities

- **Project** — the scope of one cockpit window: a **registered git repo, keyed to a stable
  id** (path is a mutable attribute), carrying an **optional** Ticket **Binding** and an
  **optional** Code host Binding. One git root = one Project (a monorepo is one Project).
  Registration is the act that creates it — an unregistered repo on disk is not a Project. One
  active Project per window; the known set lives in a per-machine file registry. The **only
  entity in the L1 triangle that Argo owns rather than observes** (Account is owned too, but
  sits outside it), and the shared base ref every session's Workspace branches from.

- **Account** — one authenticated identity with a provider: **one OAuth grant, one token in the
  OS keychain**, keyed by the **provider's own stable id** for it (login/workspace name is a
  mutable display attribute — same shape as Project's id-vs-path). **N per provider per
  machine** — a personal GitHub and a work GitHub are two Accounts, not one re-authorized; the
  same identity added twice is one Account, because the id and not the name is the key. Owned
  state, per-machine, never committed; the known set lives in a per-machine registry beside the
  Project one, holding no token itself. Revocation and expiry are **Account-level** — their
  blast radius is every Binding naming that Account, not every Binding on that provider.

- **Binding** — a Project's use of **one Account through one port**, plus the **provider-side
  scope** that Account reads through (GitHub: an `owner/repo`; Linear: a team). The unit that
  makes provider choice *per-Project*: one Project on Linear for Tickets while another is on
  GitHub Issues, each naming its own Account. **Per-port, not per-Project** — one GitHub
  Account normally fills both Bindings in one act, and nothing in the model stops the two from
  naming different Accounts. A Binding is **validated against its Account at bind time**: an
  Account that cannot see the scope is a bind-time refusal, never a run of reads that 404 and
  read as "the ticket does not exist." Health is keyed here, not on the Project (#260).

- **Ticket** — intent. One unit of work owned by a Ticket provider; **Argo stores only the link**
  (provider id + which port), never the content (title/status/body/blockers are read-through,
  cached but never authoritative). **No stored type** — "PRD" and "Task" are *roles*, taken from
  the **provider's declared type when it has one** and **falling back to hierarchy** (has
  children / is a leaf) only when the provider carries none. `blockedBy` is a provider-sourced
  dependency DAG, Argo-normalized, with blocker states **verified per-blocker** (the provider's
  summary count is stale).

  **`answer`** — a value object present *only* under the **decision-ticket** role (derived from
  the `wayfinder:<type>` label): the resolved text of a decision, **DERIVED and held verbatim**,
  formed from the `Answer:`-marked comment plus every later `Correction:`/`Amendment:`-marked
  one in creation order. A `ruled_out` closure carries `Out of scope:` instead and is
  uncomposable by construction. **No identity of its own** — addressed by the Ticket link.
  Markers match on a **plain-text projection** each Port supplies alongside a flat,
  creation-ordered comment list (provider bodies are not uniformly markdown).

  **State bucket** on that same role — `open · claimed · resolved · ruled_out`, **never
  stored**, a *bucket not a word*: the provider's own status word renders verbatim (#272); the
  bucket surfaces only where Argo must compute or group across providers. Authority splits:
  closure is **DERIVED per-port** (GitHub `state_reason`, Linear state `type`, Jira `resolution`
  through a configured mapping); `claimed` is **DIRECT** (no provider carries a claim).

  A confirmed `ruled_out` blocker **satisfies no `blockedBy` edge** — dependents render
  **stranded** until a human re-scopes one of the two. An **unresolvable** blocker blocks and
  reads `unknown`; a blocker closed with an **unreadable kind satisfies**, so ruling-out
  detection degrades to a chrome notice rather than stranding a map.

  **Every provider is remote** — GitHub Issues / Linear via OAuth; no provider connected → no
  Tickets → all sessions unlinked.

- **Delivery** — the product in flight: a **derived, branch-keyed** entity assembled per branch
  from local git facts ∪ code-host facts (PR/CI/review/merge). Comes into existence **at branch
  creation** (chat/planning sessions have no branch → no Delivery). One live Delivery = the
  current life of a branch; merge/close is its terminal state. May have **zero sessions** (a
  teammate's PR). Deployment/Release are reserved **lifecycle nodes on its strip**, not sibling
  entities (unwired).

- **Person** — a human actor, minimally **`me | other`**. Owns `Review.author` and the teammate
  distinction, and drives the "needs-**you**" attention signal. Not richer than this for v1.

### L1 relationships — a triangle, not a chain

Three independent, optional, many-to-many edges:

- **Session → Ticket** — "what am I working on" (survives with no branch). Persisted as a
  **user-asserted link only as the fallback**, when there is no Delivery to derive it through. A
  branch-backed link is *derived*, never also asserted (ADR-0017), so the edge is never
  double-sourced.

  This edge **is** the **claim lease** on a decision ticket — a ticket is `claimed` exactly
  while a live Session links to it, its age `now − link.createdAt` (DIRECT) and its release the
  session's own end; there is no TTL. Across a restart the link survives, **re-derived from the
  session's own read of its brief file**, but liveness drops to DERIVED — so the claim degrades
  to **stale** rather than reading as held: stale-on-open is takeable with a warning,
  stale-on-closed is inert (closure is read before claims). That derivation is why an
  **orphaned** session keeps its claim and a purely **external** session never holds one. The
  provider assignee is a **visible echo** for teammates, never the lease — it carries no age,
  nothing releases it, and it is written by the **agent** under `/wayfinder`, not by Argo.
- **Session → Delivery** — "which branch / product am I moving."
- **Delivery → Ticket** — "what intent does this branch serve" (survives with no session),
  derived via the join precedence (native-ref → id-in-branch → unlinked). When it derives to
  **unlinked**, the user can **assert branch→ticket manually**, persisted like the branchless
  link (ADR-0017). An assertion wins over a derived *unlinked*, **never over a positive
  derivation**.
