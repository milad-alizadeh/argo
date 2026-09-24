import {
  serveSessionIndexWorker,
  sessionIndexWorkerInputSchema,
} from '@/domains/sessions/main/sync/session-index-worker'
import { codexThreadPageSchema, parseCodexSessionPage } from './codex-discovery'

const inputSchema = sessionIndexWorkerInputSchema.extend({
  page: codexThreadPageSchema,
})

serveSessionIndexWorker(inputSchema, (input) => {
  const discovery = parseCodexSessionPage(input.page)
  return {
    sessions: discovery.sessions,
    cursor: discovery.nextCursor,
    invalidRecordCount: discovery.invalidRecordCount,
  }
})
