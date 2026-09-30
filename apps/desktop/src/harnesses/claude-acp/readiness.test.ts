import { expect, test } from 'bun:test'
import { createClaudeAcpReadiness } from './readiness'

const signedIn = async () => ({ harness: 'claude' as const, state: 'ready' as const, detail: null })

test.each([null, ''])(
  'reads missing, not the Claude sign-in, for executable %p',
  async (executable) => {
    const readiness = createClaudeAcpReadiness(() => executable, signedIn)
    expect(await readiness()).toEqual({ harness: 'claude-acp', state: 'missing', detail: null })
  },
)

test('reads the Claude sign-in once the adapter is installed', async () => {
  const readiness = createClaudeAcpReadiness(() => '/usr/local/bin/claude-agent-acp', signedIn)
  expect(await readiness()).toEqual({ harness: 'claude-acp', state: 'ready', detail: null })
})
