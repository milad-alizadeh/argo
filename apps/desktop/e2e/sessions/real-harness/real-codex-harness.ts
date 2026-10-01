import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ThreadReadResponse } from '@/harnesses/codex/app-server'
import { createCodexAppServerClient } from '@/harnesses/codex/app-server/codex-app-server-client'
import { readCodexSessionHistory } from '@/harnesses/codex/session/codex-session-history'
import type { VendorHistoryReader } from './real-session-transcript'

type CodexThread = ThreadReadResponse['thread']

function threadIdsOf(value: unknown): string[] {
  const data = typeof value === 'object' && value !== null && 'data' in value ? value.data : null
  if (!Array.isArray(data)) throw new Error('codex thread/list answered without a data list.')
  return data.map((thread: unknown) => {
    if (typeof thread === 'object' && thread !== null && 'id' in thread)
      if (typeof thread.id === 'string') return thread.id
    throw new Error(`codex thread/list answered a thread without an id: ${JSON.stringify(thread)}`)
  })
}

// The real `codex app-server`, run under the throwaway HOME through Argo's own client.
async function openCodexVendorReader(
  home: string,
  executable: string,
): Promise<VendorHistoryReader<CodexThread>> {
  const wrapper = path.join(path.dirname(home), 'codex-vendor-reader')
  await writeFile(wrapper, `#!/bin/sh\nexport HOME='${home}'\nexec '${executable}' "$@"\n`)
  await chmod(wrapper, 0o755)
  const client = createCodexAppServerClient({
    resolveExecutable: async () => ({ executable: wrapper, version: '' }),
  })
  return {
    sessionIds: () =>
      client.request(
        'thread/list',
        { limit: 100, sourceKinds: ['cli', 'vscode', 'appServer'] },
        threadIdsOf,
      ),
    records: async (threadId) =>
      (
        await client.request(
          'thread/read',
          { threadId, includeTurns: true },
          (value) => value as ThreadReadResponse,
        )
      ).thread,
    content: (threadId) => readCodexSessionHistory(client.request, threadId),
    close: () => client.shutdown(),
  }
}

export const realCodexCli = {
  authentication: ['login', 'status'],
  credential: ['.codex', 'auth.json'],
  linked: [],
  label: 'Codex',
  transcripts: (home: string) => path.join(home, '.codex', 'sessions'),
  openReader: openCodexVendorReader,
}
