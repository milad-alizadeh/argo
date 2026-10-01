import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ThreadReadResponse } from '@/harnesses/codex/app-server'
import { createCodexAppServerClient } from '@/harnesses/codex/app-server/codex-app-server-client'
import { createCodexSessionSummaryList } from '@/harnesses/codex/session/codex-session-discovery'
import { readCodexSessionHistory } from '@/harnesses/codex/session/codex-session-history'
import type { VendorHistoryReader } from './vendor-reply'

type CodexThread = ThreadReadResponse['thread']

// The real `codex app-server`, run under the throwaway HOME through Argo's own client.
export async function codexClientUnderHome(home: string, executable: string) {
  const wrapper = path.join(path.dirname(home), 'codex-vendor-reader')
  await writeFile(wrapper, `#!/bin/sh\nexport HOME='${home}'\nexec '${executable}' "$@"\n`)
  await chmod(wrapper, 0o755)
  return createCodexAppServerClient({
    resolveExecutable: async () => ({ executable: wrapper, version: '' }),
  })
}

async function openCodexVendorReader(
  home: string,
  executable: string,
): Promise<VendorHistoryReader<CodexThread>> {
  const client = await codexClientUnderHome(home, executable)
  const listSessions = createCodexSessionSummaryList(client.request)
  return {
    sessionIds: async () =>
      (await listSessions({ knownNativeIds: [] })).records.map((record) => record.nativeId),
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
