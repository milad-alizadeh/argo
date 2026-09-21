import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/runtime/run-onboarding-agent'
import type { ProjectSetupEvent } from '@/domains/projects/main/setup/project-setup-machine-types'

export type ActivePermission = {
  permissionId: string | null
  sessionId: string | null
}

export function projectSetupPermissionDecisionHandler(
  driver: OnboardingAgentDriver,
  activePermission: ActivePermission,
): (event: ProjectSetupEvent) => void {
  return (event) => {
    if (event.type !== 'Approve effect' && event.type !== 'Reject effect') return
    if (!activePermission.permissionId || !activePermission.sessionId) return
    driver.decidePermission(
      activePermission.sessionId,
      activePermission.permissionId,
      event.type === 'Approve effect' ? 'allowSimilar' : 'deny',
    )
  }
}
