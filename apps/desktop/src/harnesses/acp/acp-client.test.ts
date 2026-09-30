import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionUpdate } from '@agentclientprotocol/sdk'
import { writeMockClaudeAcp } from '../../../mocks/cli/claude-acp/mock-claude-acp-cli'
import { type AcpClient, connectAcpAgent } from './acp-client'

let root: string
let executable: string
const clients: AcpClient[] = []

async function connect(updates: SessionUpdate[] = []) {
  const connected = await connectAcpAgent(
    { executable, args: [], env: process.env },
    {
      update: (_sessionId, update) => {
        updates.push(update)
      },
      requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
    },
  )
  clients.push(connected)
  return connected
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'argo-acp-client-'))
  executable = await writeMockClaudeAcp(root, path.join(root, 'transcripts'))
})

afterEach(async () => {
  for (const connected of clients.splice(0)) connected.close()
  await rm(root, { recursive: true, force: true })
})

describe('connectAcpAgent', () => {
  test('reads the capabilities the agent advertises', async () => {
    const connected = await connect()
    expect(connected.capabilities).toEqual({
      loadSession: true,
      listSessions: false,
      resumeSession: true,
      closeSession: true,
    })
  })

  test('streams a reply live and replays it to a later process through session/load', async () => {
    const live: SessionUpdate[] = []
    const first = await connect(live)
    const { sessionId } = await first.newSession(root)
    expect(await first.prompt(sessionId, 'hello')).toBe('end_turn')
    expect(live.map((update) => update.sessionUpdate)).toEqual([
      'agent_message_chunk',
      'agent_message_chunk',
    ])
    first.close()

    const replayed: SessionUpdate[] = []
    const second = await connect(replayed)
    await second.loadSession(sessionId, root)
    expect(replayed.map((update) => update.sessionUpdate)).toEqual([
      'user_message_chunk',
      'agent_message_chunk',
      'agent_message_chunk',
    ])
  })

  test('refuses to connect when the agent cannot start', async () => {
    await expect(
      connectAcpAgent(
        { executable: path.join(root, 'missing-agent'), args: [], env: process.env },
        {
          update: () => {},
          requestPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
        },
      ),
    ).rejects.toThrow('exited before it initialized')
  })
})
