import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'

export function mockAcpSessionInput(
  cwd: string,
  prompt: string,
  turnConfiguration: SessionStartInput['turnConfiguration'] = {
    model: 'sonnet',
    effort: 'medium',
    mode: 'default',
  },
): SessionStartInput {
  return {
    harness: 'claude-acp',
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    cwd,
    commandId: 'command-1',
    prompt,
    attachments: [],
    turnConfiguration,
  }
}

export function waitForMockAcpEvent(
  events: LiveSessionChannelEvent[],
  type: LiveSessionChannelEvent['type'],
) {
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 10_000
    const check = () => {
      if (events.some((event) => event.type === type)) resolve()
      else if (Date.now() > deadline) reject(new Error(`No ${type} event arrived.`))
      else setTimeout(check, 10)
    }
    check()
  })
}
