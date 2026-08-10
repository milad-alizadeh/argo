# 0024 · The session-drive port; one adapter per CLI

Status: proposed · 2026-08-10

## Context

The cockpit needs to *drive* a Session, not just observe one: send a turn, attach a file,
interrupt, and answer a Permission. Today that means an embedded terminal the user types into.
The design goal is a composer — a plain text area — with the terminal hidden.

Hiding the terminal is cheap on the read side: the feed already comes from the transcript-tailing
parser (`Turn`/`Message`/`Thought`/`Tool Call`), never from terminal output. Only the **write**
path is at stake.

Two constraints decide it, and they point different ways per CLI.

**Billing.** Since ~2026-07-10 Anthropic bills programmatic Claude usage separately from
interactive: the Agent SDK (**TypeScript and Python alike**), `claude -p`, GitHub Actions and
third-party Agent-SDK apps are one group, drawing a single monthly credit ($20 Pro / $100 Max 5x /
$200 Max 20x) at API rates, and stopping when it is gone. Only **interactive Claude Code in a
terminal/IDE** draws the subscription allowance. The Agent SDK spawns the same `claude` binary, so
it is tempting to read it as equivalent to a PTY — it is not; the classification is by surface, and
the SDK is on the metered side of the line. Codex splits
on a different axis — by **auth method**: ChatGPT sign-in covers included usage on every surface
*including* `codex exec`; an API key bills separately. Argo must run on included tokens
(see the memory note `argo-must-use-subscription-tokens`), so headless is disqualified for
`claude` and permitted for `codex`.

**Per-action approval.** Headless turns out to be disqualified for Codex too, for an unrelated
reason: in `codex exec` stdin is closed, approvals cannot be surfaced, and `approval_policy: never`
simply fails the operation back to the model (openai/codex#24135). A cockpit that cannot answer a
Permission does not merely lose a feature — the session stalls on a prompt nobody can see.

## Decision

One **session-drive port**, adapter per `cli`. The port is the only thing the cockpit talks to:

| Operation | Meaning |
|---|---|
| `send(turn)` | prompt text for a new Turn |
| `attach(file)` | make a file available to the turn |
| `interrupt()` | stop the running Turn |
| `decide(permission)` | answer a pending Permission |

Observation is **not** on this port. The transcript parser already serves every `cli` and is
unchanged by this ADR.

Each adapter picks the CLI surface that keeps included tokens **and** can raise a Permission:

| | `claude` adapter | `codex` adapter |
|---|---|---|
| Surface | interactive TUI in a PTY Argo owns, never rendered | `codex mcp` server mode, Argo is the MCP client |
| Auth | subscription (interactive) | ChatGPT sign-in |
| `send` | bracketed paste (`ESC[200~ … ESC[201~`) | MCP tool call |
| `attach` | write into the Workspace, inject the absolute path | MCP tool call input |
| `interrupt` | `ESC` to the PTY | MCP cancellation |
| `decide` | `PreToolUse` hook returns the decision | reply to `elicitation/create` |

**Hidden is not headless.** The `claude` adapter runs the real TUI; it is only never drawn. That
is what preserves interactive billing while the user sees a composer.

### How a Permission flows

*`claude`* — a `PreToolUse` hook (a subprocess Argo owns, matcher-scoped to the gated tools)
receives `tool_name` + `tool_input`, blocks, and calls back to Argo over a local socket. The
cockpit raises the Permission; the user's answer returns as
`hookSpecificOutput.permissionDecision`. `--permission-mode` sets the standing baseline; the hook
is the per-action layer on top.

> The hook must return **`allow` or `deny`, never `ask`.** `ask` falls through to the TUI's own
> dialog — which is hidden, so the session would stall against a prompt with no reader.

**The hook's `timeout` is the cockpit's patience window.** A blocked hook is what holds the UI on
"needs input", so that timeout must be set to however long a Permission may sit unanswered — it is
a deliberate value, not a default to leave alone. Expiry is safe (it denies; see Verification) but
it *ends the turn*, so the freeze is bounded by whatever number is configured there.

*`codex`* — with `approval_policy` at `untrusted` or `on-request`, the MCP server raises approvals
as `elicitation/create`. Argo, as the client, renders the dialog and replies.

Both paths are **DIRECT**: Argo owns the channel and the decision at both ends. This is the tier
`CONTEXT.md` already assigns Permission, so no new tier is introduced — only a second source for
one that exists.

## Why

- The port is the only part that survives policy churn. Anthropic's billing rule changed three
  times between Feb and Jul 2026 (ban → split → pause → reinstate) and is stated to be under
  rework. Isolating the write path means the next change is one adapter, not a cockpit rewrite —
  the same bet ADR-0014 made on the Work Item and Code host ports.
- Headless is rejected for both CLIs, for different reasons, and neither reason is ergonomic.
  Recording *why* stops a future session rediscovering `claude -p` and reintroducing metered
  billing because the protocol is nicer. It is nicer. It is also the expensive path.
- The asymmetry is real and cannot be abstracted away at the transport layer, only above it.
  A single shared transport would have to be headless, which fails both constraints at once.

## Consequences

- **Two unlike transports to maintain.** A PTY plus terminal-escape handling for `claude`; an MCP
  client for `codex`. They share the port contract and nothing below it.
- **Argo hosts a local IPC endpoint** for the `claude` hook, and must install/own the hook config
  for sessions it spawns. A `managed` session is now partly defined by Argo's hook being wired in.
- **Blocking on a Permission is the intended behaviour, not a hazard.** The cockpit shows
  "needs input" and holds the Session there, as every agent UI does. On `claude` this is safe by
  construction: hook expiry **denies** and the turn ends cleanly (verified). On `codex` it is not —
  the MCP server hangs indefinitely if the client never replies (openai/codex#11816) — so the
  Codex adapter must impose its own deny-on-timeout.
- **The composer must be cleared after an interrupt** before the next `send`, or leftover text
  concatenates onto the injected turn.
- **`CLAUDE_CODE_CHILD_SESSION` must never reach a spawned session.** Inheriting it silently
  disables transcript persistence — which would kill the feed with no error anywhere. Argo scrubs
  its environment before spawn.
- **`external` sessions raise no Permission.** Argo's hook is not installed and it is not the MCP
  client, so the fact is unobservable and renders `unknown` — the existing degrade-down rule,
  applied without amendment. Accepted deliberately: non-Argo sessions are read-only.
- **Attachment fidelity differs by adapter.** `claude` gets a path the agent must `Read`, so the
  transcript carries embedded bytes only once the agent looks; `codex` receives content through
  the tool call. Both stay DERIVED at the feed.
- **Codex's elicitation path has known defects** — the server deserializes replies as flat structs
  rather than MCP `ElicitResult` (openai/codex#18268), and auto-approve can send an empty
  `content` against a schema that requires fields (#23383). The adapter codes to the shape the
  server accepts, not the shape the spec describes, and pins the Codex version it was verified
  against.
- **A `--permission-mode` baseline is still needed** for tools Argo chooses not to gate, or the
  hook is consulted on every read and the session crawls.

## Verification status

Against `claude` 2.1.226 and `codex-cli` 0.144.5, 2026-08-10.

**The `claude` adapter is proven.**

- Long-lived multi-turn, images, and transcript persistence (image bytes embedded) — the parser
  needs no change.
- `PreToolUse` hook round trip: the hook fired, blocked ~3s on an external decision, and the tool
  executed on `allow`.
- **Hook timeout fails closed.** With a 5s timeout and no answer, the tool came back
  `is_error: true` and the file was not written. No silent fall-through to the hidden TUI dialog,
  no stall — the turn ended and the agent asked for approval in prose.
- **`ESC` interrupts a running turn.** Mid-essay, output stopped dead (0 chars over the following
  5s), the TUI showed `Interrupted · What should Claude do instead?`, the process stayed alive, and
  a follow-up turn was answered. The transcript records it as a first-class entry —
  `[Request interrupted by user]` — so the interrupt is observable from the feed, not only the PTY.

**The `codex` adapter is not proven — treat it as the open risk.** `codex mcp-server` exists and
exposes `codex` / `codex-reply` with `approval-policy` and `sandbox` arguments, but no approval
elicitation could be observed across three configurations (default, `mcp_servers={}`, and a fully
isolated `CODEX_HOME`): every `tools/call` stalled after `session_configured`. Notably the server's
`initialize` reply advertises **only** `capabilities: {tools: {listChanged: true}}` — it declares
no elicitation capability, and approvals appear to travel as `codex/event` notifications rather
than MCP `elicitation/create`. That is consistent with the known defects
(openai/codex#18268, #11816, #23383) and may mean a client cannot answer them by the standard
mechanism at all in this version.

Before `accepted`: demonstrate a Codex approval round trip, or replace the Codex adapter's
approval channel with something that works and re-record it here.
