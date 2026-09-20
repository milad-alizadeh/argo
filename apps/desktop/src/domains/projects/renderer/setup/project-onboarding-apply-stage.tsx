import { CheckCircle2, Circle, LoaderCircle, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  applyTasksFor,
  type OnboardingApplyTask,
  type OnboardingController,
} from './project-onboarding'
import {
  ProjectOnboardingStageActions as StageActions,
  ProjectOnboardingStageHeader as StageHeading,
} from './project-onboarding-layout'
import { OptionRow } from './project-onboarding-primitives'

export function ApplyStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  return (
    <>
      <StageHeading description={t('onboarding.flow.apply.description')}>
        {t('onboarding.flow.apply.title')}
      </StageHeading>
      <ApplyTaskList controller={controller} />
      {state.waitingTaskId ? (
        <div className="mt-5 flex items-center justify-between rounded-xl border bg-card p-4">
          <p className="type-label text-muted-foreground">{t('onboarding.flow.apply.waiting')}</p>
          <Button onClick={controller.actions.continueApply}>
            {t('onboarding.flow.apply.continue')}
          </Button>
        </div>
      ) : null}
    </>
  )
}
export function ApplyFailedStage({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { actions, state } = controller
  const failed = state.targets.find(({ id }) => id === state.failureTargetId)
  return (
    <>
      <StageHeading
        description={t('onboarding.flow.applyFailed.description', {
          target: failed?.name ?? t('onboarding.target.fallbackName'),
        })}
      >
        {t('onboarding.flow.applyFailed.title')}
      </StageHeading>
      <ApplyTaskList controller={controller} />
      <StageActions>
        <Button onClick={actions.editFailedTarget} variant="outline">
          {t('onboarding.flow.applyFailed.edit')}
        </Button>
        <Button onClick={actions.retryApply}>{t('onboarding.flow.applyFailed.retry')}</Button>
      </StageActions>
    </>
  )
}
function ApplyTaskList({ controller }: { controller: OnboardingController }) {
  const { state } = controller
  return (
    <ol className="onboarding-task-list mt-8">
      {applyTasksFor(state).map((task, index) => {
        const status = applyTaskStatus(task, index, state)
        return (
          <li data-status={status} key={task.id}>
            <OptionRow
              detail={task.detail}
              icon={<TaskStatusIcon status={status} />}
              title={task.label}
            />
          </li>
        )
      })}
    </ol>
  )
}
type TaskStatus = 'pending' | 'running' | 'waiting' | 'passed' | 'failed'
function applyTaskStatus(
  task: OnboardingApplyTask,
  index: number,
  state: OnboardingController['state'],
): TaskStatus {
  if (index < state.applyStep) return 'passed'
  if (index > state.applyStep) return 'pending'
  if (state.stage === 'apply-failed' && task.targetId === state.failureTargetId) return 'failed'
  if (state.waitingTaskId === task.id) return 'waiting'
  return 'running'
}
function TaskStatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'running') return <LoaderCircle className="size-4 animate-spin" />
  if (status === 'passed') return <CheckCircle2 className="size-4" />
  if (status === 'failed') return <XCircle className="size-4" />
  return <Circle className={`size-4 ${status === 'waiting' ? 'fill-foreground/10' : ''}`} />
}
