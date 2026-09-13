# 0039 · Desktop IPC uses an operation table per domain

Status: accepted · 2026-09-13

## Context

The desktop IPC contract had separate lists for renderer calls, preload channels, and main-process handlers. An operation could reach one list and not another. Reply checks also used hand-written type guards. A guard returned a boolean, then a caller cast the value. That pattern did not give the caller the parsed data.

## Decision

Each IPC domain declares one operation table. An entry contains the operation name, channel, request schema, and reply schema. The renderer client builds the envelope. A renderer call sends only its operation fields. The preload bridge reads the channel from the table. The main-process bridge reads the same channel from the table.

Every request, reply, Roster row, and Feed row uses a Zod schema. Its TypeScript type uses `z.infer`. A boundary parser returns its parsed data. Callers use that result.

To add an operation:

1. Add its entry to the domain operation table.
2. Add its main-process handler.
3. Add accepted and refused inputs to the parameterized schema test.

## Consequences

The wire envelope stays inside the client. Renderer code cannot select a channel or reuse an old request ID. A new operation changes one table and one handler. Schema failures become the existing `invalid-response` error at the renderer boundary.
