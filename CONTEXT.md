# Argo

A voice-driven, render-only observability cockpit over stock agentic CLIs (Claude Code + Codex). It observes and — only on explicit user gesture — acts; it never orchestrates agents itself.

## Language

**Cockpit**:
The Argo application as a whole: the window that observes running agent sessions and lets the user steer them. Render-only — it visualizes work the sessions produce, it does not drive them.
_Avoid_: dashboard, IDE, console

**Session**:
One stock agentic CLI run (a `claude` or `codex` process) observed by the cockpit — discovered from the CLI's own transcript on disk. The top-level unit on the rail. **Managed** Sessions are additionally spawned and wrapped in a PTY by the cockpit (enabling the companion plugin and steering); **external** Sessions (started in a plain terminal) are observed read-only from their transcript. All Sessions are observed; only managed ones carry the CONVENTION-tier derived layer. A Session spans a **resume-chain** of one-or-more CLI session files (linked by `leafUuid`), stitched at read time so Outcomes carry across a resume.
_Avoid_: process, tab, terminal

**Actor**:
The recursive node of the observability tree. A Session and an Agent are both Actors; an Actor may own Runs, and an Agent leaf may itself own Runs (genuine recursion). An Actor may also own a Workspace and a Preview — both belong to the Actor, not to the Session (ADR-0010).

**Workspace**:
Where an Actor does its work: a branch and a directory, either the main tree or a git worktree. A worktree-isolated Agent has its own Workspace, distinct from its parent Session's; an Actor without one inherits its parent's. Rendered in exactly one place per screen.
_Avoid_: cwd, repo, checkout

**Agent**:
A unit of work spawned inside a Session — a Claude subagent/Task, or a Codex Turn. An Actor that is not the top-level Session.
_Avoid_: subagent (in UI copy), worker, thread

**Run**:
A structured multi-agent effort hanging under an Actor. Two shapes: a **batch** (agents in parallel) or a **dynamic workflow** (agents in stages). Claude-only vocabulary.
_Avoid_: pipeline (in UI copy — the old name of the staged shape)

**Phase**:
A named group of Agents within a Run (e.g. Review → Verify → Synthesize).

**Concierge**:
The local, on-device, audio-to-audio conversational voice layer. State-aware but read-only — it narrates what the cockpit already knows and never reasons about code or becomes an agent. Optional/toggleable.
_Avoid_: assistant, bot, brain

**Router**:
The reasoning step invoked only when a spoken utterance needs an action; resolves intent + target into `{action, target, payload}`. Runs on the subscription (headless CLI), never metered.
_Avoid_: dispatcher, NLU

**Companion plugin**:
The single shared plugin (Claude-Code / Codex `.claude-plugin` standard) the cockpit loads into every managed Session, giving it an MCP status/ask/report channel. Required in managed sessions.
_Avoid_: extension, addon

**Panes**:
The four toggleable regions of an Actor's screen: **Activity** (time-keyed prose), **Ship** (sha-keyed product), **Preview** (the running UI), **Console** (raw I/O). One button group selects them; each pane repeats its own icon in its header. Supersedes the Story/Work naming of ADR-0009.
_Avoid_: Story, Work, Detail, tab

**Preview**:
An Actor's own UI, running and rendered inside the cockpit — a browser surface over a dev server the cockpit starts, on gesture, inside that Actor's Workspace. At most one runs at a time. It shows the working tree *including uncommitted work*, which is what separates it from every sha-addressed surface (ADR-0011).
_Avoid_: live view, sandbox, simulator (that is one Source)

**Preview source**:
One entry in the observed project's declared preview list — Storybook, the app renderer, later a device simulator. The pane offers only what the project declares; the cockpit never guesses a command.

**Ship ribbon**:
The Ship pane's lifecycle header — artifact nodes Commits → PR → CI → Review → Merge, the sole owner of ship-flow state. A node's done-state is a fact about a sha and can go **stale**; the head (leftmost non-fresh node) carries the screen's one primary control. Spec: `docs/designs/cockpit-matrix.md` (ADR-0009).
_Avoid_: pipeline (that word is a Run shape), stepper

**Gate**:
A ship-ribbon transition that publishes or lands work (Create PR, Merge). Human-clicked by default; delegable per session as a standing order (rendered `⚙ auto`, revocable) — the only sanctioned form of the cockpit acting without a per-action gesture.

**Outcome**:
A natural-language accomplishment produced by a Session ("what got done"), each carrying a provenance tag and clickable to its diff/artifact. Its diff link is **git-addressed** (commit SHA(s) in the Session's cwd); an Outcome with no commit backing has no stable link, never a fabricated one. Computed once and cached — never regenerated on app open (ADR-0008).

**Honesty tier**:
The provenance grade of any field the cockpit renders. **DIRECT** (clean from transcript/git, zero inference) · **DERIVED** (computed/estimated, fragile) · **CONVENTION** (requires an Argo skill/plugin to own the prompt+output). A field renders per its tier; nothing is FABRICATED. A Preview canvas carries no tier — it is not a claim the cockpit makes but the running thing itself; the chrome around it (running state, port, branch cleanliness, source) is DIRECT.
