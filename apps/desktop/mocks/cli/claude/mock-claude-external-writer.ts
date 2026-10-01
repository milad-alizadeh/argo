import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { ExternalWriter } from '../mock-external-clis'
import { type mockClaudeAgentsCli, recordedClaudeAgent } from './mock-claude-agents'
import { claudeProjectFolder } from './mock-claude-transcripts'

// A Claude CLI outside Argo: it appends to its transcript and shows busy in `claude agents --json`.
export function claudeExternalWriter(input: {
  sessionId: string
  cwd: string
  agents: ReturnType<typeof mockClaudeAgentsCli>
}): ExternalWriter {
  const { sessionId, cwd, agents } = input
  const folder = claudeProjectFolder(
    path.join(process.env.CLAUDE_CONFIG_DIR as string, 'projects'),
    cwd,
  )
  mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${sessionId}.jsonl`)
  let parentUuid: string | null = null
  let count = 0
  const write = (type: 'user' | 'assistant', content: unknown) => {
    count += 1
    const uuid = `00000000-0000-4000-8000-${String(count).padStart(12, '0')}`
    const record = {
      type,
      cwd,
      sessionId,
      timestamp: new Date(Date.UTC(2026, 9, 1, 10, 0, count)).toISOString(),
      uuid,
      parentUuid,
      message:
        type === 'user'
          ? { role: 'user', content }
          : { role: 'assistant', stop_reason: 'end_turn', content },
    }
    appendFileSync(file, `${JSON.stringify(record)}\n`)
    parentUuid = uuid
  }
  return {
    say: (role, text) => write(role, role === 'user' ? text : [{ type: 'text', text }]),
    delegate: () => {
      write('assistant', [
        {
          type: 'tool_use',
          id: 'agent-call',
          name: 'Agent',
          input: { description: 'Review feed', subagent_type: 'reviewer', prompt: 'Review.' },
        },
      ])
      // The launch result names the Subagent, as the recorded `delegationHistory` one does.
      const launched =
        'Async agent launched successfully.\nagentId: a0d1e2f3a4b5c6d7e (internal ID)'
      write('user', [{ type: 'tool_result', tool_use_id: 'agent-call', content: launched }])
    },
    listLive: async () => agents.answer([recordedClaudeAgent(sessionId, 'busy')]),
    exit: async () => agents.answer([]),
  }
}
