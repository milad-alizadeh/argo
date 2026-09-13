# Desktop runtime validation and Zod

## Scan

The desktop source tree contains 273 TypeScript/TSX files. A search of production source (excluding
tests) found 42 files with runtime parsing or validation and 199 matching uses of `JSON.parse`,
`isRecord`, `hasKeys`, `typeof`, or `Array.isArray`. Zod is not a direct dependency; it appears only
transitively through the MCP SDK in `bun.lock` (`zod@3.25.76`). Adding it to application code would
therefore be a dependency decision, not reuse of an existing app abstraction.

## Best Zod candidates

- **IPC contracts:** `apps/desktop/src/core/projects/contract.ts`, `messages.ts`,
  `apps/desktop/src/core/sessions/contract.ts`, `replies.ts`, and
  `apps/desktop/src/core/sessions/roster-row-check.ts`. These are repetitive closed-object schemas
  crossing the preload boundary. Zod object schemas, discriminated unions, literal versions, and
  enums would replace most `hasKeys`/field checks while keeping one schema as both parser and type
  source. Keep the public `is...` functions as thin boolean wrappers if callers depend on them.
- **Persisted project registry:** `apps/desktop/src/core/projects/registry.ts`. The document has a
  stable versioned shape and is parsed at one storage boundary, making a Zod schema a good fit.
- **Persisted appearance:** `apps/desktop/src/core/appearance/appearance.ts` and `bridge.ts`.
  This is another small versioned JSON document where schema failure can cleanly select defaults.
- **Small JSON build inputs:** `apps/desktop/src/storybook/storybook-build.ts`. Its `entries`,
  `modules`, and `reasons` structures are stable tool output and could use local schemas, though this
  is lower priority than IPC and persisted state.

## Keep handwritten parsers

- `apps/desktop/src/agents/claude/sessions/records.ts` and
  `apps/desktop/src/agents/codex/sessions/records.ts`: these are tolerant JSONL readers. They must
  preserve unreadable lines, accept provider-specific variants, and project many partial record
  shapes into domain rows. A strict Zod parse would obscure that policy; use small local schemas only
  for stable nested fragments if duplication becomes painful.
- `apps/desktop/src/agents/claude/sessions/archive.ts` and transcript discovery/readers: filesystem
  errors, partial files, and archive semantics are domain behavior rather than schema validation.
- `apps/desktop/src/core/sessions/signals.ts`, `delegation.ts`, `status.ts`, and roster projections:
  these interpret already-parsed domain messages and should remain explicit business rules.
- `apps/desktop/src/agents/claude/drive/*`: request validation belongs in the shared IPC contract;
  process launch errors and PTY lifecycle checks are operational behavior, not Zod concerns.

## Recommendation

Adopt Zod only if the project is willing to make it a direct desktop dependency. Start with one
boundary at a time—projects IPC plus registry—then sessions IPC if the resulting error behavior and
unknown-key policy match the current contracts. Do not convert provider transcript parsers wholesale.
The current handwritten validators intentionally enforce exact keys, identifier limits, fixed error
messages, and tolerant malformed-record projections; those semantics must be preserved with Zod
options/refinements or retained code, not lost in a mechanical rewrite.

Sources: [`boundary.ts`](../../apps/desktop/src/boundary.ts), [`projects/contract.ts`](../../apps/desktop/src/core/projects/contract.ts), [`projects/messages.ts`](../../apps/desktop/src/core/projects/messages.ts), [`sessions/contract.ts`](../../apps/desktop/src/core/sessions/contract.ts), [`sessions/replies.ts`](../../apps/desktop/src/core/sessions/replies.ts), [`sessions/roster-row-check.ts`](../../apps/desktop/src/core/sessions/roster-row-check.ts), [`projects/registry.ts`](../../apps/desktop/src/core/projects/registry.ts), [`appearance.ts`](../../apps/desktop/src/core/appearance/appearance.ts), [`storybook-build.ts`](../../apps/desktop/src/storybook/storybook-build.ts), [`Claude records`](../../apps/desktop/src/agents/claude/sessions/records.ts), [`Codex records`](../../apps/desktop/src/agents/codex/sessions/records.ts), and [Zod basic usage](https://zod.dev/?id=basic-usage).
