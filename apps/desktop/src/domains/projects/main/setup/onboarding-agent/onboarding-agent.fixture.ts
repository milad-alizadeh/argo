import type { OnboardingAgentDriver } from './run-onboarding-agent'

export function driverEmitting(...frames: string[]): OnboardingAgentDriver {
  let index = 0
  return {
    start: () => 'session-1',
    liveMessages: () => {
      const text = frames[Math.min(index, frames.length - 1)] ?? ''
      index += 1
      return [{ id: 'message-1', text }]
    },
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => false,
  }
}
