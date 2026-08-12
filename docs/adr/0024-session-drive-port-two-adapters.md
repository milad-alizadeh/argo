# 0024 · The session-drive port; one adapter per CLI

Status: accepted · 2026-08-12 (proposed 2026-08-10; Codex channel corrected to app-server and verified, #547)

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
| Surface | interactive TUI in a PTY Argo owns, never rendered | `codex app-server`, JSON-RPC over stdio, Argo is the client |
| Auth | subscription (interactive) | ChatGPT sign-in |
| `send` | bracketed paste (`ESC[200~ … ESC[201~`) | `turn/start` |
| `attach` | write into the Workspace, inject the absolute path | `input` item on `turn/start` |
| `interrupt` | `ESC` to the PTY | `turn/interrupt` |
| `decide` | `PreToolUse` hook returns the decision | respond to the server's `requestApproval` request |

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

**The hook's `timeout` is the cockpit's patience window, and it is set a day out.** A blocked hook
is what holds the UI on "needs input", so the timeout is how long a Permission may sit unanswered —
a deliberate value, not a default to leave alone. Expiry is safe (it denies; see Verification) and
it *ends the turn*, which is exactly why the number is large: nobody watches the cockpit for the
whole of an agent's run, so a window short enough to expire is a window that decides on its own.
The prompt draws no clock for the same reason (#542 rewrote the study's decision 6).

**The hook is registered by the companion PLUGIN, not by `--settings`.** Against claude 2.1.226 a
`hooks` block in a settings file passed as `--settings <path>` is never registered — `/hooks` shows
the same count with and without it, and a gated call runs unstopped. The same block written to the
plugin's `hooks/hooks.json` and loaded with `--plugin-dir <root>` registers and fires. This matters
beyond configuration: an unregistered hook fails **open**, silently, because the CLI treats a hook
that produced nothing as no opinion. The gate is therefore covered by a live-CLI test rather than
by a fixture that could only ever prove Argo talks to itself.

*`codex`* — with `approvalPolicy` at `untrusted` or `on-request`, the app-server raises an
approval as a **server→client JSON-RPC request**: `item/commandExecution/requestApproval` for a
command, `item/fileChange/requestApproval` for a patch. Argo renders the dialog and answers by
responding to the request's `id` with `{"decision": "accept" | "acceptForSession" | "decline" |
"cancel"}` — `decline` refuses the action and the turn continues; `cancel` also interrupts it.
While the request is open the thread reports `activeFlags: ["waitingOnApproval"]`, which is the
cockpit's "needs input" signal. Not MCP elicitation: `codex mcp-server` never raised one
(verified dead end, 0.144.5).

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

- **Two unlike transports to maintain.** A PTY plus terminal-escape handling for `claude`; a
  JSON-RPC stdio client for `codex app-server`. They share the port contract and nothing below it.
- **Argo hosts a local IPC endpoint** for the `claude` hook, and must install/own the hook config
  for sessions it spawns. A `managed` session is now partly defined by Argo's hook being wired in.
- **Blocking on a Permission is the intended behaviour, not a hazard.** The cockpit shows
  "needs input" and holds the Session there, as every agent UI does. On `claude` this is safe by
  construction: hook expiry **denies** and the turn ends cleanly (verified). On `codex` the server
  never times out on its own (a 60s unanswered hold stayed open; openai/codex#11816), so the
  adapter imposes its own deny-on-timeout — verified: a late `decline` refuses the operation, the
  turn ends cleanly, and the thread answers a follow-up turn.
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
- **The Codex approval contract is observed, not specified.** `codex app-server` is marked
  experimental, and the exec request's `availableDecisions` omitted `decline` even though
  `decline` was accepted and honored — so the field is advisory for UI, never the contract. The
  adapter codes to the shapes recorded in the research doc and pins the Codex version it was
  verified against. The MCP elicitation defects (openai/codex#18268, #23383) no longer apply to
  the chosen channel.
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
  no stall — the turn ended and the agent asked for approval in prose. Shipped at a day, so this
  is the safety net rather than the mechanism.
- **The gate itself is under test against the real CLI** (`ARGO_LIVE_CLI=1`, excluded from the
  default run): a spawned session asked to run one command raises the Permission in the Hub; on
  `allow` the command's file appears, and on `deny` it never does.
- **`ESC` interrupts a running turn.** Mid-essay, output stopped dead (0 chars over the following
  5s), the TUI showed `Interrupted · What should Claude do instead?`, the process stayed alive, and
  a follow-up turn was answered. The transcript records it as a first-class entry —
  `[Request interrupted by user]` — so the interrupt is observable from the feed, not only the PTY.

**The `codex` adapter channel is proven — against `codex-cli` 0.147.0, 2026-08-12 (#547).**
Full JSON-RPC transcripts and reproduction: `docs/research/2026-08-12-codex-app-server-approvals.md`.

- **Exec approval round trip.** Under `approvalPolicy: "untrusted"`, `codex app-server` raised
  `item/commandExecution/requestApproval` as a server→client JSON-RPC request; the client
  responded `{"decision": "accept"}` and the command executed.
- **Patch approval round trip.** Under a `read-only` sandbox, `item/fileChange/requestApproval`
  was raised and answered `accept`; the file was written. The diff for the dialog arrives on the
  `item/started` notification and `turn/diff/updated`, joined by `itemId`.
- **Deny-on-timeout is implementable and demonstrated.** The server held an unanswered approval
  open for 60s with no timeout of its own; a late `{"decision": "decline"}` was honored — the
  item completed `status: "declined"`, the file was never created, the turn ended cleanly, and
  the same thread answered a follow-up turn.
- **`codex mcp-server` remains a dead end** (0.144.5, 2026-08-10): no approval elicitation across
  three configurations (default, `mcp_servers={}`, isolated `CODEX_HOME`); every `tools/call`
  stalled after `session_configured`, and `initialize` advertised only
  `capabilities: {tools: {listChanged: true}}`. The adapter uses app-server, not MCP.
