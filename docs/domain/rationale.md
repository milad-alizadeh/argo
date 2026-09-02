# Domain model — why the terms are what they are

Companion to `CONTEXT.md`. That file is normative and injected into every agent session, so it
carries **only** what an agent needs to *apply* the model. This file carries what was needed to
*settle* it — prior-art derivation, rejected alternatives, and the reasoning behind bans.

**Read this when changing a term.** Never to apply one — if a rule isn't in `CONTEXT.md`, it
isn't binding.

## Provenance

The model was rebuilt from scratch under #182 ("Domain model — the locked source of truth"),
ACP-aligned, grilled layer by layer. Every term survived re-justification against ACP / Claude
Code / Codex / Cursor + observability prior art (OTel, LangSmith, Langfuse). The prior model is
retired: see git history for `docs/designs/cockpit-domain-model.md`.

## Storage & ownership

Persisting a derived join is the drift bug **ADR-0008 killed the SQLite mirror to avoid** —
hence the Hub holds the join as a throwaway in-memory projection rather than writing it down.

## L1

**Account and Binding are two levels, not one.** The model said a Project "carries a Ticket
provider," which reads as if choosing a provider and authorizing it were one act. They are not:
authorizing happens once per identity per machine, choosing happens once per Project. Collapsing
them forces a re-grant on every new Project and makes a personal-vs-work GitHub unrepresentable
— which is the case that broke it (#414).

**Account is keyed by the provider's id, not the login.** Same argument as Project's
id-vs-path: a renamed GitHub login or Linear workspace must not read as a new identity, and the
same identity added twice must not become two Accounts with two tokens drifting apart.

**Binding is per-port, not per-Project.** One GitHub Account filling both ports is the normal
case and stays a single act in the UI, but it is a *coincidence of the common case*, not a
constraint worth encoding — and per-port costs nothing, since the ports already have separate
adapters and separate failures.

**Bind-time validation is load-bearing.** A wrong Account is silent: every read returns 404,
which is indistinguishable from an issue that does not exist. Validating at bind time is the
only point where the two can still be told apart.

**Ticket, and not Work Item or Issue (#881).** The term was `Work Item` until 2026-08-28, defined
in this very model as "a ticket owned by a provider" — the word it should have been called. Every
surface downstream then said *ticket* anyway: `AGENTS.md`, `docs/agents/worktrees.md`'s
`argo/#<N>-<slug>` branch, `/implement <N>` spoken aloud, and Argo's own UI layer, which drew a
`WorkItem` as `TicketHead` and `TicketBody`. One noun with two names either side of the port
boundary is the thing this model exists to forbid, and `Work Item` was the half nobody spoke.

*Work Item* also borrowed from a provider Argo does not integrate: it is Azure DevOps's term, and
the neutrality it bought was neutrality against a tracker nobody here uses, paid for in a word the
team does not say.

*Issue* was considered and rejected on three counts. It collides with everyday English (*an issue*
= a problem) and with `Finding` in the review vocabulary, where "issue" already means a defect. Not
every item is one: `type` covers PRDs and decision tickets, and an **answer** is the resolved text
of *a decision ticket* — calling a PRD an issue is the same category error as calling it a work
item, in the other direction. And it privileges GitHub's and Linear's own word at the one boundary
where a provider's vocabulary must not leak. `Ticket` is provider-neutral **and** already the house
word, which is the pair `Work Item` was reaching for and missed.

**Ticket — provider-declared type over hierarchy.** The fallback to hierarchy (has children /
is a leaf) exists so a *childless PRD* isn't miscast as a Task. Providers that declare a type
(GitHub issue types, Linear's project/milestone/issue distinction) are believed first.

**`blockedBy` verified per-blocker.** The provider's summary count is stale. See also the
`ruled_out` rule below.

**`ruled_out` satisfies no edge.** Argo deliberately disagrees with the GitHub and Linear UIs
here, which both count a cancelled blocker as satisfied. The dependent renders *stranded* until
a human re-scopes one of the two — surfacing the ambiguity rather than silently unblocking work
whose premise was cancelled. The degradation is asymmetric on purpose: a blocker closed with an
*unreadable* kind satisfies, so a port that can't read closure kinds produces a chrome notice,
not a stranded map.

**Comment markers on a plain-text projection.** Provider bodies are not uniformly markdown —
Linear threads replies, Jira Cloud stores ADF — so the Port supplies the projection rather than
each consumer re-parsing a format it can't know.

**Local-file/vault Ticket provider** was considered and **descoped**. Every provider is
remote.

**The L1 triangle supersedes ADR-0013's "join only through Delivery."** Three independent edges,
not a chain — because a planning session pinned to a ticket has no branch to derive through, and
a teammate's PR has no session.

**Branch→ticket manual assertion (ADR-0017).** Without this escape hatch the whole triangle
silently empties for ordinary hand-named branches with no PR — the common case outside
`/implement`.

## L2

**`managed` is not extra spec over `external`.** External is the baseline: transcript-tailing is
the floor for every session, and its DERIVED-liveness machinery is mandatory anyway for Argo's
own sessions across a restart. Managed = external + PTY steering + CONVENTION channel.

**Orphaned is a posture, not a kind.** Adding a fourth stored classification would imply Argo
could restore steering by writing a value down; it can't — the channel died with the process.

**`starting` is a status because the SIGNAL is real, not because the wait is.** #585 declined to
report a spawn's boot at all: the only fact on hand was "managed and nothing written yet", which
has no end, and a wall-clock timer would have been a guess wearing an observation's clothes. What
made it a term was Argo owning the PTY — the child's first bytes are DIRECT, and a claim with an
end Argo witnessed is a state rather than a spinner (#587).

**`SessionFacts` dissolved.** Naming it as an entity would duplicate the homes its members
already have (Workspace / Delivery / Session status) and invite drift. What is real is the
honesty tier on each fact, not the bundle.

## L3 — the naming rebuild

Names were re-derived from what Claude Code / Codex / Cursor / ACP + observability tools
literally use, replacing the old `Actor` / `Run` / `Phase` coinages.

| Dropped | Why |
|---|---|
| `Actor` | Zero prior art; misleading Actor-model and GitHub-`actor` baggage. |
| `kind: session \| agent` | Every spec treats a session **as** an agent. Neither OTel spans nor LangSmith runs distinguish a *session* node type from an *agent* one — the root is structural (position), not a type tag. Both *do* carry a per-node operation/`run_type` kind, which Argo re-expresses as the separate **Tool Call** entity, not on the node. |
| `Run` / `Dispatch` | `Run` collides with LangSmith's single-unit `Run`. |
| `Phase` | None of the CLIs have a runtime "Phase" — it lives as derived rendering over the tree. |

**Subagent** is the unanimous term across CC / Codex / Cursor; reserving `Agent` for the node and
`Subagent` for the child is how those tools disambiguate.

**Turn** is first-class in ACP ("prompt turn"); an internal per-turn context in Codex
(`TurnContext`, an implementation struct, not a protocol surface); synthesized from the DAG for
CC — which is why the stop reason needs an `unknown` member ACP doesn't have.

**Message vs Thought kept in one ordered sequence.** Two lists would lose emission order, and
emission order is the only thing that says which reasoning produced which answer.

**Tool Call — why Result is a kinded value object.** The same call can yield the agent's own
bytes or a weaker read from disk; a fact with two possible provenances needs somewhere to carry
which one it was, so the tier rides on the Result rather than on loose fields beside `target`.

**Why media prefers embedded bytes.** Agents re-render one screenshot path several times within
a turn, so path-first rendering would show the newest picture under the oldest paragraph. Gating
on the declared image *type* rather than the tool's name is because a screenshot reaches the
agent from a read, a fetch, or an MCP browser tool.

**Why the feed's diff is bounded to a first hunk** but L4's isn't: prose is the primary row in
the feed, and a 400-line edit would bury it.

**Why times sit on the Tool Call.** A Turn is a bookkeeping seam and its calls land seconds
apart, so the call is the grain at which a time is worth rendering.

**Plan is Session-scoped (ADR-0020).** ACP delivers it as a session-level update carrying the
**complete** entry list each time, and CC's TodoWrite outlives the turn that wrote it.

**Workspace is node-scoped (ADR-0010).** The case the ADR exists for: a Subagent without its own
worktree must render no second chip.

**Usage is partially ACP-informed, not one ACP object.** Context `used`/`size` + `cost` map to
ACP's session-level `UsageUpdate`; per-turn in/out tokens map to ACP's `PromptResponse.usage`
(RFD-stage, unpopulated in real agents today); **cache tokens are not in any ACP shape** — a
Claude-specific extra.

## L4

**Keep the host's vocabulary verbatim.** Renaming a Check or a PR state would misrepresent what
we observed. This is the same rule the DERIVED tier generalizes.

**No Job/Step tree under Check** — a deferred drill, not an omission.

**Local lint/test deliberately unmodeled.** CI is the authoritative pass/fail; local enforcement
lives in pre-commit hooks + prose. Reimplementing a local runner would create a second, weaker
source of truth for the same question.

**Outcome persists while Delivery doesn't** because a CONVENTION-tier outcome may never have
existed in a transcript (ADR-0008) — there is nothing to re-derive it from.

## Autonomy

**`Read Only | Plan | Code | Auto` is Argo's own ladder** — informed by ACP's illustrative example
(`ask/architect/code`) and CC's `plan` mode, but **not an ACP term**; ACP is sunsetting dedicated
mode methods.

**The rungs are boundaries because Codex's are** (ADR-0025). Codex's `Read Only` and `Auto`
presets share one `approval_policy` (`on-request`) and differ only in `sandbox_mode`, so a rung
there says *how far a non-asking action reaches*, and asking is what happens at the edge of it.
Claude cuts the same space by prompt frequency instead, splitting `default` from `acceptEdits` at
one boundary. Argo takes the boundary reading because it is the one both CLIs can express: a
frequency ladder has rungs Codex cannot reach at all.

**`Ask` was dropped for colliding with the field's meaning.** Cursor, Zed and Copilot all use
`Ask` for the read-only chat mode — Argo's `Plan`, not Argo's old `Ask`. A label that names the
wrong sibling is worse than a longer one, and Claude Code hit the same hazard and renamed its
`default` to **Manual** across every UI surface.

**The superseded triplet was `Ask | Plan | Code`.** It laid one dial across two axes — `Ask` and
`Code` are endpoints of how often you are asked, `Plan` is a point on what may be touched — and
had no rung between gating everything and acting freely, which is where most sessions actually
sit.

## Experience

**`marked` was rationed to a GROUND, never a state, because the palette had already spent it
that way** (#760). Five surfaces had reached for the word independently — the menu cursor, the
chosen ask option, a name with a kind glyph, the minimap's rectangles, and the ground — and
`mark*` ran to 792 occurrences in `Shell/Deck/` alone, which is the point at which grep stops
being a navigation tool. Only one of the five had the word written down anywhere: `ArgoPalette`
and `TextRoles` both document `marked` as a *ground*, and `text.marked(on:)` is a rule about ink
standing on it. A token the visual contract defines outranks four ad-hoc local usages, so the
rename went the other way round from the usual "most callers win". The line is ground-versus-state
rather than machine-text-versus-everything, because `surface.marked` legitimately grounds a keycap
and a spent send button too — what it must never do is stand in for the fact that a row is current
or an option chosen, which is where the five senses came from.

**The menu cursor took `current`, not `highlighted`.** `highlighted` names how a row is DRAWN,
and the row is drawn on a ground the palette already owns a word for — so the pair would have
read as two names for one fill. `current` names the row's place in the list instead, which is the
fact the keyboard actually moves, and it stays true for a cursor row that is off screen and
therefore drawn as nothing at all.

**`MinimapRect` is geometric on purpose.** The lane's rectangle carries no domain fact of its
own — a row hands it `y`, a span and an ink, and the same type draws a line of prose, a table
cell and a piece of a call's sentence. A domain word here would claim a meaning the type does not
hold, and the honest alternative was already taken: what the rectangle MEANS is its `FeedInk`.
