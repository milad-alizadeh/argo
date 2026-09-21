import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import { type OnboardingAgentDriver, runOnboardingAgent } from './run-onboarding-agent'

export function runMarkedAgent<Event>({
  driver,
  request,
}: {
  driver: OnboardingAgentDriver
  request: {
    cwd: string
    effort?: ClaudeTurnSetup['effort']
    marker: string
    mode: ClaudeTurnSetup['mode']
    model?: ClaudeTurnSetup['model']
    onPermission?: (permission: { id: string; description: string }) => void
    onProgress?: (event: Event) => void
    onStarted?: (sessionId: string) => void
    parseProgress: (text: string) => Event[]
    pollIntervalMs?: number
    prompt: string
    sessionId?: string
    timeoutMs?: number
  }
}) {
  let announced = 0
  return runOnboardingAgent(driver, {
    cwd: request.cwd,
    effort: request.effort,
    marker: request.marker,
    mode: request.mode,
    model: request.model,
    onPermission: request.onPermission,
    onProgress: (text) => {
      const events = request.parseProgress(text)
      for (const event of events.slice(announced)) request.onProgress?.(event)
      announced = events.length
    },
    onStarted: request.onStarted,
    pollIntervalMs: request.pollIntervalMs,
    prompt: request.prompt,
    sessionId: request.sessionId,
    timeoutMs: request.timeoutMs,
  })
}
