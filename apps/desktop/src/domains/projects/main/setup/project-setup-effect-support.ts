import type { SetupStepStatus } from '@/domains/projects/contract/setup-progress'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/run-onboarding-agent'

export async function cancelProjectSetup(
  driver: OnboardingAgentDriver,
  sessionId: string,
): Promise<void> {
  await driver.interrupt(sessionId)
  await driver.waitForStop?.(sessionId)
}

export function createProgressReporter(
  onProgress: (
    progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>,
  ) => void,
) {
  const progress = new Map<string, { stepId: string; status: SetupStepStatus; message: string }>()
  return (event: { stepId: string; status: SetupStepStatus; message: string }) => {
    progress.set(event.stepId, {
      stepId: event.stepId,
      status: event.status,
      message: event.message,
    })
    onProgress([...progress.values()])
  }
}
