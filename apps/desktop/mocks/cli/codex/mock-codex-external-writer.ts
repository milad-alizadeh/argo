import { writeFileSync } from 'node:fs'
import type { ExternalWriter } from '../mock-external-clis'
import { holdCodexWriterLock } from './mock-codex-external-threads'

// A Codex CLI outside Argo: one Turn in the vendor history the mock app-server reads from
// `historyFile`, live while it holds the thread's writer lock.
export function codexExternalWriter(input: {
  sessionId: string
  cwd: string
  historyFile: string
}): ExternalWriter {
  const { sessionId, cwd, historyFile } = input
  const items: unknown[] = []
  const locks: (() => Promise<void>)[] = []
  const write = () =>
    writeFileSync(
      historyFile,
      JSON.stringify({
        threads: [
          {
            id: sessionId,
            cwd,
            name: null,
            updatedAt: 1_790_000_000,
            status: { type: 'idle' },
            turns: [{ id: 'turn-1', status: 'completed', startedAt: 1_790_000_000, items }],
          },
        ],
      }),
    )
  return {
    say: (role, text) => {
      const id = `item-${items.length + 1}`
      items.push(
        role === 'user'
          ? { type: 'userMessage', id, content: [{ type: 'text', text, text_elements: [] }] }
          : { type: 'agentMessage', id, text, phase: null },
      )
      write()
    },
    delegate: () => {
      for (const kind of ['started', 'completed'])
        items.push({
          type: 'subAgentActivity',
          id: `agent-${kind}`,
          kind,
          agentThreadId: 'agent-thread',
          agentPath: '/root/review_feed',
        })
      write()
    },
    listLive: async () => {
      locks.push(await holdCodexWriterLock(process.env.CODEX_HOME as string, sessionId))
    },
    exit: async () => {
      for (const release of locks.splice(0)) await release()
    },
  }
}
