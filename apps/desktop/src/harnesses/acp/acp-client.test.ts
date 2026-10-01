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
  test('resumes an advertised Session without replaying its stored updates', async () => {
    const first = await connect()
    const session = await first.newSession(root)
    await first.prompt(session.sessionId, 'saved')
    first.close()
    const updates: SessionUpdate[] = []
    const second = await connect(updates)
    expect((await second.resumeSession(session.sessionId, root)).sessionId).toBe(session.sessionId)
    expect(updates).toEqual([])
    expect(await second.prompt(session.sessionId, 'continued')).toBe('end_turn')
  })
})

describe('connectAcpAgent', () => {
  test('rejects every optional method when the agent does not advertise it', async () => {
    await writeMockClaudeAcp(root, path.join(root, 'transcripts'), { capabilities: {} })
    const connected = await connect()
    await expect(connected.listSessions()).rejects.toThrow('does not advertise session/list')
    await expect(connected.loadSession('saved', root)).rejects.toThrow(
      'does not advertise session/load',
    )
    await expect(connected.resumeSession('saved', root)).rejects.toThrow(
      'does not advertise session/resume',
    )
    await expect(connected.closeSession('saved')).rejects.toThrow(
      'does not advertise session/close',
    )
  })

  test('reads the capabilities the agent advertises', async () => {
    const connected = await connect()
    expect(connected.capabilities).toEqual({
      loadSession: true,
      listSessions: true,
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
