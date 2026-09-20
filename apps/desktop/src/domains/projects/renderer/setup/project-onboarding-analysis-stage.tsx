import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Progress, ProgressLabel } from '@/platform/renderer/components/ui/progress'
import { i18n } from '@/platform/renderer/i18n/i18n'
import { ANALYSIS_TASKS, type OnboardingController } from './project-onboarding'
import { OptionRow } from './project-onboarding-primitives'
import { StageHeadingWithBack } from './project-onboarding-stage-navigation'

function analysisTaskText(taskId: string, field: 'detail' | 'label') {
  const key = `projects:onboarding.task.${taskId}.${field}`
  return i18n.t(key, { defaultValue: taskId })
}

export function AnalyzingStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  const progress = ((state.analysisStep + 1) / ANALYSIS_TASKS.length) * 100
  return (
    <>
      <StageHeadingWithBack
        controller={controller}
        description={t('onboarding.flow.analyzing.description')}
        title={t('onboarding.flow.analyzing.title')}
      />
      <div className="mt-9 max-w-2xl">
        <p className="project-setup-shimmer type-heading" role="status">
          {analysisTaskText(ANALYSIS_TASKS[state.analysisStep]?.id ?? 'inspect-folder', 'detail')}
        </p>
        <Progress className="mt-5" value={progress}>
          <ProgressLabel>{t('onboarding.flow.analyzing.progress')}</ProgressLabel>
          <span className="ml-auto type-label text-muted-foreground">
            {t('onboarding.flow.analyzing.progressCount', {
              current: state.analysisStep + 1,
              total: ANALYSIS_TASKS.length,
            })}
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
