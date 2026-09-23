import type { OnboardingAgentDriver } from './onboarding-agent/runtime/run-onboarding-agent'

export async function interruptAndWaitForProjectSetupSession(
  driver: Pick<OnboardingAgentDriver, 'interrupt' | 'waitForStop'>,
  sessionId: string,
): Promise<void> {
  await driver.interrupt(sessionId)
  await driver.waitForStop?.(sessionId)
}
