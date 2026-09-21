import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/runtime/run-onboarding-agent'
import { reconcileSetupWorktree } from '@/domains/projects/main/setup/preparation/setup-worktree'
import { observeSourceFingerprints } from '@/domains/projects/main/setup/preparation/source-fingerprints'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'

export async function reconcileProjectSetupApplication({
  acceptedPlan,
  driver,
  projectId,
  projects,
  sessionId,
}: {
  acceptedPlan: AcceptedSetupPlan
  driver: OnboardingAgentDriver
  projectId: string
  projects: ProjectStore
  sessionId: string
}): Promise<{ kind: 'current' } | { kind: 'drifted'; reason: 'application-drift' }> {
  const project = projects.read().projects.find((candidate) => candidate.id === projectId)
  if (!project) return { kind: 'drifted', reason: 'application-drift' }
  if (driver.hasSession?.(sessionId) !== true)
    return { kind: 'drifted', reason: 'application-drift' }
  const source = await observeSourceFingerprints(project.path, acceptedPlan.fingerprints)
  if (source.kind === 'drifted') return source
  const checkpoint = projects.readSetupCheckpoint(project.id)
  if (!checkpoint) return { kind: 'drifted', reason: 'application-drift' }
  return reconcileSetupWorktree(project, checkpoint.worktreePath)
}

export async function findProjectSetupApplicationDrift({
  acceptedPlan,
  driver,
  projectId,
  projectPath,
  projects,
  sessionId,
}: Omit<Parameters<typeof reconcileProjectSetupApplication>[0], 'sessionId'> & {
  projectPath: string
  sessionId?: string
}) {
  if (sessionId) {
    const reconciliation = await reconcileProjectSetupApplication({
      acceptedPlan,
      driver,
      projectId,
      projects,
      sessionId,
    })
    if (reconciliation.kind === 'drifted') return reconciliation.reason
  }
  const source = await observeSourceFingerprints(projectPath, acceptedPlan.fingerprints)
  return source.kind === 'drifted' ? source.reason : null
}
