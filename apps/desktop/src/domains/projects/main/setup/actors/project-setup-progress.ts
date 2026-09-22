import type { SetupStepStatus } from '@/domains/projects/contract/setup'

export type ProjectSetupProgress = Array<{
  stepId: string
  status: SetupStepStatus
  message: string
}>

export function projectSetupProgressReporter(report: (progress: ProjectSetupProgress) => void) {
  const progress = new Map<string, ProjectSetupProgress[number]>()
  return (event: ProjectSetupProgress[number]) => {
    progress.set(event.stepId, event)
    report([...progress.values()])
  }
}
