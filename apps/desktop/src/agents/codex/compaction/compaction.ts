// The Codex auto-compact threshold contract, shared by the bundled main process and renderer.
// The value lives in the person's own `~/.codex/config.toml` (config-file.ts), never in git, so
// it is custom per machine with DEFAULT_AUTO_COMPACT_LIMIT as the sensible starting point.
import { z } from 'zod'
import { createDomainClient } from '../../../core/contract/domain'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  message,
} from '../../../core/contract/messages'

// #1904's chosen threshold: consistent across models until Codex sessions carry their own. Kept
// here, not in config-file.ts, so this module stays free of `node:fs` and safe for the renderer
// to import.
export const DEFAULT_AUTO_COMPACT_LIMIT = 180_000

// Mirrors the range the composer's slider and number input already offer.
export const AUTO_COMPACT_LIMIT_MIN = 80_000
export const AUTO_COMPACT_LIMIT_MAX = 190_000

export const autoCompactLimitSchema = z
  .number()
  .int()
  .min(AUTO_COMPACT_LIMIT_MIN)
  .max(AUTO_COMPACT_LIMIT_MAX)

export const codexCompactionReplySchema = message('codex-compaction.state', {
  limit: autoCompactLimitSchema,
})
export type CodexCompactionReply = z.infer<typeof codexCompactionReplySchema>

export const CODEX_COMPACTION_ERRORS = {
  'access-denied': 'Argo cannot change the Codex auto-compact threshold from here.',
  'unsupported-version': 'This Codex compaction contract version is not supported.',
  'invalid-request': 'The Codex compaction request is invalid.',
  'invalid-response': 'Argo received an invalid Codex compaction response.',
  'connection-lost': 'The connection to Argo was lost.',
} as const
export type CodexCompactionErrorCode = keyof typeof CODEX_COMPACTION_ERRORS
export type CodexCompactionError = ContractError<'codex-compaction.error', CodexCompactionErrorCode>
export const codexCompactionError = errorFactory('codex-compaction.error', CODEX_COMPACTION_ERRORS)
const codexCompactionErrorSchema = errorSchema('codex-compaction.error', CODEX_COMPACTION_ERRORS)

export const CODEX_COMPACTION_OPERATIONS = {
  get: {
    name: 'codex-compaction.get',
    channel: 'argo:codex-compaction:get',
    request: message('codex-compaction.get', {}),
    reply: codexCompactionReplySchema.or(codexCompactionErrorSchema),
  },
  set: {
    name: 'codex-compaction.set',
    channel: 'argo:codex-compaction:set',
    request: message('codex-compaction.set', { limit: autoCompactLimitSchema }),
    reply: codexCompactionReplySchema.or(codexCompactionErrorSchema),
  },
} as const

export type CodexCompactionClient = {
  getCodexAutoCompactLimit(): Promise<number>
  setCodexAutoCompactLimit(limit: number): Promise<number>
}

function limitOf(reply: CodexCompactionReply | CodexCompactionError): number {
  return reply.type === 'codex-compaction.error' ? DEFAULT_AUTO_COMPACT_LIMIT : reply.limit
}

export function createCodexCompactionClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): CodexCompactionClient {
  const client = createDomainClient(CODEX_COMPACTION_OPERATIONS, invoke, codexCompactionError)
  return {
    getCodexAutoCompactLimit: async () => limitOf(await client.get()),
    // A limit outside the composer's own range is never sent: the renderer reads the current
    // value back instead of asking the main process to reject its own request.
    setCodexAutoCompactLimit: async (limit) =>
      limitOf(
        await (autoCompactLimitSchema.safeParse(limit).success
          ? client.set({ limit })
          : client.get()),
      ),
  }
}
