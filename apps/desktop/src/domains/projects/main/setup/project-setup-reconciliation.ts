import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import type { OnboardingAgentDriver } from '@/domains/projects/main/setup/onboarding-agent/run-onboarding-agent'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { reconcileSetupWorktree } from './setup-worktree'
import { observeSourceFingerprints } from './source-fingerprints'

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
}): Promise<{ kind: 'current' } | { kind: 'drifted'; reason: string }> {
  const project = projects.read().projects.find((candidate) => candidate.id === projectId)
  if (!project) return { kind: 'drifted', reason: 'The Project is no longer registered.' }
  if (driver.hasSession?.(sessionId) !== true)
    return { kind: 'drifted', reason: 'The recorded application Session is no longer available.' }
  const source = await observeSourceFingerprints(project.path, acceptedPlan.fingerprints)
  if (source.kind === 'drifted') return source
  const checkpoint = projects.readSetupCheckpoint(project.id)
  if (!checkpoint) return { kind: 'drifted', reason: 'The recorded setup worktree is unavailable.' }
  return reconcileSetupWorktree(project, checkpoint.worktreePath)
}
