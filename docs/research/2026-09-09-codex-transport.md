# Codex transport and composer delivery

Ticket: [#1826](https://github.com/milad-alizadeh/argo/issues/1826), within [#1824](https://github.com/milad-alizadeh/argo/issues/1824).
Status: proposed resolution, with a passing live protocol proof. Human agreement is pending.

## Proposed resolution

Keep one owned `codex app-server --listen stdio://` process per managed Codex Session.
The Electron main process uses `node:child_process.spawn` with separate stdin, stdout, and stderr pipes.
The Codex adapter sends newline-delimited JSON requests and reads matching responses and notifications.
It drains stderr separately. Terminal escapes, bracketed paste, and terminal resize do not belong on this channel.

This preserves [ADR-0024](../adr/0024-session-drive-port-two-adapters.md) and the Codex clause of
[#1791](https://github.com/milad-alizadeh/argo/issues/1791#issuecomment-5603751079).
It supersedes the claim in [#1781](https://github.com/milad-alizadeh/argo/issues/1781#issuecomment-5605022097)
that both CLIs use bracketed paste through a PTY.
It also supersedes that comment's claim that a structured Codex input channel is unavailable.
The same claims in #1730 and the unmerged ADR-0034 need this correction when their records are updated.

The chip decision survives: a chip decorates ordinary draft text, and recognition never rewrites that text.
This resolution adds no structured skill or plugin sidecars.
The protocol supports `skill` and `mention` input variants, but adding them changes the text-only product contract.
That requires separate agreement. A decorative chip cannot promise native skill selection or plugin invocation.

## Submission and attachments

Freeze the draft and attachment list together for each submission.
After `initialize` succeeds, send `initialized`, then `thread/start` or `thread/resume`.
Wait for that response before submitting a Turn.
Keep the draft available until the server accepts the submission.
A pipe write alone does not prove that the server accepted it.

Send `turn/start` with the current `threadId` and an `input` array.
Its first item is `{"type":"text","text":draft,"text_elements":[]}`.
Preserve leading and trailing whitespace, newlines, Unicode, paths, and sigils exactly.
Do not trim the draft, substitute chip labels, expand placeholders, or add an Enter character.
Send the chosen Model, Effort, and Mode through their protocol fields, under the existing Session contract.
TUI slash commands have no guaranteed meaning on this channel.

Attachments remain separate from the draft:

- Stage local images at durable absolute paths in main-process-owned storage. Append one `localImage` item per image, in attachment order.
- Represent other local files with separate `text` input items containing their absolute paths. This is a file reference, not an upload.
- Keep staged files available for the Session and its resume history. Reject inaccessible or unsupported attachments before sending any part of the submission.

The file-reference text item is exactly `{"type":"text","text":absolutePath,"text_elements":[]}`.
Codex must read such a file through its tools and current permissions to obtain its bytes.
The protocol has no generic `file` input variant.
Image acceptance does not prove that a model understood the image.
This proof covers image delivery only. File-reference reading and attachment storage remain acceptance work for the control slice.

Serialize pending submissions at the semantic driver boundary owned by #1825.
If a response is lost, retain the unresolved submission and reconcile the thread history before another send.
Do not retry `turn/start` automatically or silently switch transport.
The request `id` correlates a response. It does not establish duplicate suppression.

## Capability probing

The live `initialize` result contains `userAgent`, `codexHome`, `platformFamily`, and `platformOs`.
It contains no method or notification inventory.
Its input `capabilities` describes the client, not the server.
Therefore the capability-inventory probe specified in
[#1756](https://github.com/milad-alizadeh/argo/issues/1756#issuecomment-5590528058) cannot run as written.

Replace that mechanism with two sources of evidence:

1. Run `app-server generate-json-schema` against the resolved executable during capability discovery. Inspect its declarations for the methods, input variants, and notifications the adapter supports.
2. Complete the live handshake. Validate each later response at the boundary, and degrade the affected capability when the server refuses or changes its shape.

Schema declarations show what the binary declares. They do not prove that credentials, model access, or a live operation work.
An unreadable schema or unrecognized shape produces unknown capability evidence and a degraded Session.
Keep unavailable controls disabled with a reason. Preserve observation of the Session.
If the handshake fails, report that the control channel is unavailable.
Do not report a usable control channel merely because the CLI satisfies the version floor.

The required baseline includes `thread/start`, `thread/read`, `thread/resume`, `turn/start`, `turn/interrupt`,
`turn/started`, `turn/completed`, and `thread/status/changed`.
Permission and question controls require their own request and response shapes before they become available.
The CLI gate owns discovery, caching, invalidation, and the floor. #1825 owns how this evidence crosses its interfaces.
This correction preserves #1756's floor, no ceiling, checked override, and degrade-down policy.

The first live attempt passed initialization but failed its Turn because the configured `gpt-6-astra` required a newer Codex.
`model/list` advertised `gpt-5.6-sol` as its default. An explicit rerun with that model passed.
Production must show the model refusal and retain the user's choice. It must not silently substitute a different model.

## Interrupt and resume

Record the server's current Turn identifier from `turn/start` and `turn/started`.
Send `turn/interrupt` with that Turn identifier and the owning `threadId`.
An empty response acknowledges the request. Wait for `turn/completed` to establish the final Turn status.
If the Turn already completed, reconcile its status instead of inventing an interruption.
Keep the user's unsent draft. Preserve the existing explicit queue-cancellation policy.

When the owned process exits, its live control channel is gone.
Persist the Codex thread identifier with Argo's ownership record.
To resume, start a fresh process, complete initialization, and call `thread/resume` with that identifier.
Wait for the matching resumed thread before sending another Turn.
Never create a replacement thread silently when resume fails.
External Sessions remain observational until an explicitly authorized ownership transition.

The live proof interrupted an accepted Turn before it produced output.
It then terminated the owned process, resumed the same thread in a new process, and recovered an earlier token.
This proves protocol continuity. It does not prove crash recovery during a tool call or complete descendant-process cleanup.

## Evidence and reproduction

Run date: September 9, 2026. Host: macOS arm64. Node: 24.20.0. Codex: 0.147.0. Model: `gpt-5.6-sol`.
The [probe](../../prototypes/codex-transport/prove.mjs) asserts behavior through the real CLI boundary named by #1826.
It uses a temporary Workspace, the existing sign-in, a read-only sandbox, and three bounded Turns.
It does not control the keyboard or mouse.

```sh
node prototypes/codex-transport/prove.mjs /absolute/path/to/codex gpt-5.6-sol
```

The probe prints its private raw transcript path.
Each protocol wait expires after 45 seconds, and each process has an 8 MB transcript limit.
The test stops on unexpected server requests instead of granting them.
The temporary files and CLI-owned transcript remain available for inspection.

The [bounded transcript](../../prototypes/codex-transport/transcript.jsonl) contains selected fields from actual requests and responses.
It replaces temporary paths, thread identifiers, and Turn identifiers with stable placeholders.
It omits unrelated notifications, configuration, and response fields. It is an evidence excerpt, not a replay fixture.
The generated protocol declarations were read from this executable before the probe was written.
Reproduce those declarations with `codex app-server generate-ts --out /tmp/codex-protocol` and `generate-json-schema --out /tmp/codex-schema`.

The assertions passed for exact draft text, image input in server history, interrupted status, resumed thread identity, and the recovered token.
The initial model refusal is a real negative result. There is no production implementation in this change and no claimed production red/green cycle.

This proof does not cover the following capabilities:

- Native skill or plugin sidecars, TUI commands, audio, arbitrary file uploads, or pasted-content side tables.
- Permission decisions, structured questions, standing permissions, and expiry. ADR-0024 holds earlier evidence for some of these.
- Packaged Electron lifecycle, attachment persistence, reconnect races, file reads, renderer behavior, or Windows and Linux execution.

Computer-use issue #1780 remains outside this work.
The proof does not implement #1825's portable interfaces or the managed-control slice.
