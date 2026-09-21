import type { ProjectSetupContext } from './project-setup-machine-types'

export function updateCurrentAttemptEvidence(
  context: ProjectSetupContext,
  change: Partial<ProjectSetupContext['attemptEvidence'][number]>,
) {
  const number = context.attemptNumber
  if (number === null) return context.attemptEvidence
  return context.attemptEvidence.map((attempt) =>
    attempt.number === number ? { ...attempt, ...change } : attempt,
  )
}
