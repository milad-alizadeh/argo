# Codex approvals round-trip over `codex app-server`

**Date:** 2026-08-12 · **For:** [#547](https://github.com/milad-alizadeh/argo/issues/547), unblocking the Codex adapter of ADR-0024 under [#535](https://github.com/milad-alizadeh/argo/issues/535) · **Status:** demonstrated by execution, transcripts below

## Verdict

**`codex app-server` is a working approval channel.** Both approval kinds round-tripped, and
deny-on-timeout is implementable by the client alone. Verified against **codex-cli 0.147.0**
(macOS 26.5.1, arm64, ChatGPT sign-in) on 2026-08-12.

- An **exec approval** arrived as the server→client JSON-RPC request
  `item/commandExecution/requestApproval`; the client replied `{"decision": "accept"}` and the
  command ran.
- A **patch approval** arrived as `item/fileChange/requestApproval`; the client replied
  `accept` and the file was written.
- **Deny-on-timeout works.** The server imposes no deadline of its own: an approval held
  unanswered for 60 s stayed open. A late `{"decision": "decline"}` was honored — the item
  completed with `status: "declined"`, the file was never created, the turn ended cleanly, and
  the same thread answered a follow-up turn.

The `codex mcp-server` dead end recorded against 0.144.5 on 2026-08-10 stands. Approvals were
never MCP `elicitation/create`; on app-server they are plain JSON-RPC **requests from server to
client**, which the client answers by JSON-RPC **response**. That is the whole mechanism.

## The protocol, as exercised

Transport is **newline-delimited JSON-RPC 2.0 over stdio** (`codex app-server`, default
`--listen stdio://`). The server also ships its own schema:
`codex app-server generate-json-schema --out <dir>`, which is where every shape below can be
re-derived from.

Client → server, in order:

1. `initialize` request with `clientInfo: {name, title, version}`. The response names the
   resolved `userAgent` and `codexHome`.
2. `initialized` notification.
3. `thread/start` request. The probe used
   `{cwd, approvalPolicy: "untrusted", sandbox: "workspace-write" | "read-only", ephemeral: true}`.
   Response carries `thread.id`.
4. `turn/start` request with `{threadId, input: [{type: "text", text}]}`. Response carries
   `turn.id`; progress arrives as notifications (`item/started`, `item/agentMessage/delta`,
   `turn/completed`, …).

Server → client, when the policy gates an action, one JSON-RPC **request** (it has an `id`; the
client must respond to that `id`):

- `item/commandExecution/requestApproval` — shell command approval.
- `item/fileChange/requestApproval` — apply_patch approval.

The response shape for both is `{"decision": <decision>}`. Command decisions:
`accept · acceptForSession · {acceptWithExecpolicyAmendment} · {applyNetworkPolicyAmendment} ·
decline · cancel`. File-change decisions: `accept · acceptForSession · decline · cancel`.
Per the server's own schema, `decline` lets the agent continue the turn; `cancel` also
interrupts the turn.

Two sharp edges observed:

- The exec request's `availableDecisions` field listed only `accept`,
  `acceptWithExecpolicyAmendment`, and `cancel` — **no `decline`** — yet `decline` was accepted
  and honored. Treat `availableDecisions` as advisory for UI, not as the contract.
- The file-change request is lean (`itemId`, `threadId`, `turnId`, `reason`, `grantRoot`); the
  diff content travels separately, in the `item/started` notification for the same `itemId` and
  in `turn/diff/updated`. A client rendering a patch dialog joins on `itemId`.

## Transcript: exec approval, answered `accept`

Thread started with `approvalPolicy: "untrusted"`, `sandbox: "workspace-write"`. Prompt:
"Run exactly this command: touch approved.txt — then stop." Bulky `hook/*`,
`account/rateLimits/updated`, and delta notifications are elided; every message of the approval
exchange itself is verbatim.

```jsonc
// -> client
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"argo-spike-547","title":"Argo approval spike","version":"0.0.1"}}}
// <- server
{"id":1,"result":{"userAgent":"argo-spike-547/0.147.0 (Mac OS 26.5.1; arm64) WarpTerminal/v0.2026.08.05.09.03.stable_01 (argo-spike-547; 0.0.1)","codexHome":"/Users/milad/.codex","platformFamily":"unix","platformOs":"macos"}}
// -> client
{"jsonrpc":"2.0","method":"initialized"}
{"jsonrpc":"2.0","id":2,"method":"thread/start","params":{"cwd":"<workdir>","approvalPolicy":"untrusted","sandbox":"workspace-write","ephemeral":true}}
// <- server (response carries thread.id; notifications elided)
// -> client
{"jsonrpc":"2.0","id":3,"method":"turn/start","params":{"threadId":"019ff5cd-e41a-7e52-bb6c-3dcecae54e3e","input":[{"type":"text","text":"Run exactly this command: touch approved.txt — then stop. Do not run anything else."}]}}

// <- server: THE APPROVAL, a JSON-RPC request with id 0
{"method":"item/commandExecution/requestApproval","id":0,"params":{
  "threadId":"019ff5cd-e41a-7e52-bb6c-3dcecae54e3e",
  "turnId":"019ff5cd-e511-7323-934c-63421a46fdd9",
  "itemId":"exec-699c8dab-6365-421f-b5da-9d955a2022e5",
  "startedAtMs":1786535350364,
  "environmentId":"local",
  "command":"/bin/zsh -lc 'touch approved.txt'",
  "cwd":"<workdir>",
  "commandActions":[{"type":"unknown","command":"touch approved.txt"}],
  "proposedExecpolicyAmendment":["touch","approved.txt"],
  "availableDecisions":["accept",{"acceptWithExecpolicyAmendment":{"execpolicy_amendment":["touch","approved.txt"]}},"cancel"]}}

// -> client: THE ANSWER, a JSON-RPC response to id 0
{"jsonrpc":"2.0","id":0,"result":{"decision":"accept"}}

// <- server
{"method":"serverRequest/resolved","params":{"threadId":"019ff5cd-e41a-7e52-bb6c-3dcecae54e3e","requestId":0}}
{"method":"item/completed","params":{"item":{"type":"commandExecution","id":"exec-699c8dab-6365-421f-b5da-9d955a2022e5","command":"/bin/zsh -lc 'touch approved.txt'","status":"completed", /* … */ }}}
{"method":"turn/completed","params":{"turn":{"id":"019ff5cd-e511-7323-934c-63421a46fdd9","status":"completed","items":[{"type":"agentMessage","text":"Done.", /* … */ }]}}}
```

Verified on disk: `approved.txt` existed after the turn.

While an approval is pending the thread reports
`thread/status/changed → {"type":"active","activeFlags":["waitingOnApproval"]}`, and the flag
clears on the reply — that is the "needs input" signal for the cockpit, arriving without any
transcript parsing.

## Transcript: patch approval, answered `accept`

Thread started with `approvalPolicy: "untrusted"`, `sandbox: "read-only"`. Prompt: "Create a
file named patched.txt containing the single line: hello from patch. Use apply_patch, not a
shell command."

```jsonc
// <- server: the approval request
{"method":"item/fileChange/requestApproval","id":0,"params":{
  "threadId":"019ff5ce-6ab4-7241-8821-149dd48f37c4",
  "turnId":"019ff5ce-6b69-72f2-82f3-4a98cb660d5c",
  "itemId":"exec-cba7e588-a066-4515-bc22-e5863e6bcdec",
  "startedAtMs":1786535382280,
  "reason":null,
  "grantRoot":null}}

// -> client
{"jsonrpc":"2.0","id":0,"result":{"decision":"accept"}}

// <- server (the diff content for the dialog had already arrived on the item, and lands in turn/diff/updated)
{"method":"turn/diff/updated","params":{"threadId":"019ff5ce-6ab4-7241-8821-149dd48f37c4","turnId":"019ff5ce-6b69-72f2-82f3-4a98cb660d5c","diff":"diff --git a/patched.txt b/patched.txt\nnew file mode 100644\n--- /dev/null\n+++ b/patched.txt\n@@ -0,0 +1 @@\n+hello from patch\n"}}
{"method":"turn/completed","params":{"turn":{"id":"019ff5ce-6b69-72f2-82f3-4a98cb660d5c","status":"completed", /* … */ }}}
```

Verified on disk: `patched.txt` existed with the expected content.

## Transcript: deny-on-timeout

Same thread setup as the exec run. Prompt: "Run exactly this command: touch denied.txt — then
stop." The client held the request unanswered for a fixed 60 s interval, then sent the deny
late.

```jsonc
// <- server, t=7.74s
{"method":"item/commandExecution/requestApproval","id":0,"params":{
  "threadId":"019ff5d0-8e30-7062-93b5-bcdac403622e",
  "turnId":"019ff5d0-8ee2-7f00-a4a3-07344f7f561d",
  "itemId":"exec-d23994bf-7fa4-4f3c-80b2-f59c7e79f51a",
  "startedAtMs":1786535521356,
  "environmentId":"local",
  "command":"/bin/zsh -lc 'touch denied.txt'",
  "cwd":"<workdir>",
  "commandActions":[{"type":"unknown","command":"touch denied.txt"}],
  "proposedExecpolicyAmendment":["touch","denied.txt"],
  "availableDecisions":["accept",{"acceptWithExecpolicyAmendment":{"execpolicy_amendment":["touch","denied.txt"]}},"cancel"]}}

// -> client, t=67.74s — 60.0s later, the late deny
{"jsonrpc":"2.0","id":0,"result":{"decision":"decline"}}

// <- server, t=67.74s
{"method":"item/completed","params":{"item":{"type":"commandExecution","id":"exec-d23994bf-7fa4-4f3c-80b2-f59c7e79f51a","status":"declined", /* … */ }}}
{"method":"turn/completed","params":{"turn":{"status":"completed","items":[{"type":"agentMessage","text":"The command was rejected; `denied.txt` was not created."}], /* … */ }}}

// -> client: follow-up turn on the SAME thread
{"jsonrpc":"2.0","id":4,"method":"turn/start","params":{"threadId":"019ff5d0-8e30-7062-93b5-bcdac403622e","input":[{"type":"text","text":"Reply with the single word: alive"}]}}
// <- server
{"method":"turn/completed","params":{"turn":{"status":"completed","items":[{"type":"agentMessage","text":"alive"}], /* … */ }}}
```

Verified on disk: `denied.txt` was never created.

What this proves for the adapter: Codex still never times out an approval on its own — the 60 s
hold sat open with no complaint, consistent with openai/codex#11816 — but the client owns both
ends of the request, so **deny-on-timeout is just the cockpit answering `decline` (or `cancel`)
when its own clock expires.** The operation is refused, the turn ends cleanly, and the thread
remains usable. Argo's patience window can therefore be as long as it likes, exactly as on the
`claude` adapter.

## Reproducing

1. `codex login status` must say ChatGPT sign-in (included usage; subscription-tokens rule).
2. Spawn `codex app-server`, speak newline-delimited JSON-RPC on its stdio.
3. Send the four-message client sequence above; per scenario set `sandbox` to
   `workspace-write` (exec) or `read-only` (patch), `approvalPolicy: "untrusted"`.
4. Answer the server request by responding to its `id` with `{"decision": …}`.

The probe was a ~180-line throwaway Node script (spawn + JSONL framing + a promise per request
id); it is deliberately not kept. Shapes can be re-derived any time from
`codex app-server generate-json-schema`. One environment note: the probe ran against the real
`CODEX_HOME`, so the transcripts also carry `hook/started`/`hook/completed` notifications from
installed plugins — noise for this question, elided above.

## What changes in ADR-0024

The Codex adapter's surface is **`codex app-server`, not `codex mcp` / MCP elicitation**. The
`decide(permission)` row becomes "respond to the server's `requestApproval` JSON-RPC request";
`send` is `turn/start`, `interrupt` is `turn/interrupt`. The elicitation-defect consequences
(openai/codex#18268, #23383) stop applying to the chosen channel. Deny-on-timeout moves from
open risk to verified: client-imposed, `decline` on expiry.
