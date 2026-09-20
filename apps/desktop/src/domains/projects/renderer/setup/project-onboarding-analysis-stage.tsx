import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'
import { Progress, ProgressLabel } from '@/platform/renderer/components/ui/progress'
import { i18n } from '@/platform/renderer/i18n/config'
import { ANALYSIS_TASKS, type OnboardingController } from './project-onboarding'
import { ProjectOnboardingStageHeader as StageHeading } from './project-onboarding-layout'
import { BackAction, OptionRow } from './project-onboarding-primitives'

function analysisTaskText(taskId: string, field: 'detail' | 'label') {
  return i18n.t(`projects:onboarding.task.${taskId}.${field}`)
}

export function AnalyzingStage({ controller }: { controller: OnboardingController }) {
  const { state } = controller
  const progress = ((state.analysisStep + 1) / ANALYSIS_TASKS.length) * 100
  return (
    <>
      <StageHeading
        back={<BackAction controller={controller} />}
        description="The setup agent builds a plan. It does not write files, install dependencies, or run Project commands yet."
      >
        2 · Analyze the Project
      </StageHeading>
      <div className="mt-9 max-w-2xl">
        <p className="project-setup-shimmer type-heading" role="status">
          {analysisTaskText(ANALYSIS_TASKS[state.analysisStep]?.id ?? 'inspect-folder', 'detail')}
        </p>
        <Progress className="mt-5" value={progress}>
          <ProgressLabel>Planning</ProgressLabel>
          <span className="ml-auto type-label text-muted-foreground">
            {state.analysisStep + 1} of {ANALYSIS_TASKS.length}
          </span>
        </Progress>
        <PlanningTaskList current={state.analysisStep} />
      </div>
    </>
  )
}

function PlanningTaskList({ current }: { current: number }) {
  return (
    <ol className="onboarding-task-list mt-7">
      {ANALYSIS_TASKS.map((task, index) => {
        const status = planningTaskStatus(index, current)
        return (
          <li data-status={status} key={task.id}>
            <OptionRow
              detail={analysisTaskText(task.id, 'detail')}
              icon={<PlanningTaskStatusIcon status={status} />}
              title={analysisTaskText(task.id, 'label')}
            />
          </li>
        )
      })}
    </ol>
  )
}

function planningTaskStatus(index: number, current: number): PlanningTaskStatus {
  if (index < current) return 'passed'
  if (index === current) return 'running'
  return 'pending'
}

type PlanningTaskStatus = 'pending' | 'running' | 'passed'

function PlanningTaskStatusIcon({ status }: { status: PlanningTaskStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="size-4" />
    case 'running':
      return <LoaderCircle className="size-4 animate-spin" />
    case 'passed':
      return <CheckCircle2 className="size-4" />
  }
}
