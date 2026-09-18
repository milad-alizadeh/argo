// The main process owns the read and write of `~/.codex/config.toml` (config-file.ts); the
// renderer only ever sees the resolved limit.
import type { BrowserWindow } from 'electron'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'
import {
  CODEX_COMPACTION_OPERATIONS,
  type CodexCompactionReply,
  codexCompactionError,
} from './compaction'
import { readAutoCompactLimit, writeAutoCompactLimit } from './config-file'

function reply(requestId: string, limit: number): CodexCompactionReply {
  return { version: 1, type: 'codex-compaction.state', requestId, limit }
}

export type CodexCompactionStorage = { home: string; rendererURL: string }

export function attachCodexCompactionBridge(
  window: BrowserWindow,
  storage: CodexCompactionStorage,
): void {
  const { home, rendererURL } = storage
  registerDomainHandlers({
    window,
    rendererURL,
    operations: CODEX_COMPACTION_OPERATIONS,
    context: home,
    handlers: {
      get: async (request, data) => reply(request.requestId, await readAutoCompactLimit(data)),
      set: async (request, data) => {
        await writeAutoCompactLimit(data, request.limit)
        return reply(request.requestId, request.limit)
      },
    },
    error: codexCompactionError,
  })
}
