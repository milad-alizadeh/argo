import { useTranslation } from 'react-i18next'
import {
  indicatorToneRecipe,
  statusToneRecipe,
} from '@/platform/renderer/components/design-system/tone-recipes'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { RunningText } from '@/platform/renderer/components/running-text'
import { Button } from '@/platform/renderer/components/ui/button'
import { cn } from '@/platform/renderer/lib/utils'
import type { ProjectSetupCommand, ProjectSetupSnapshot } from './onboarding-presentation'

import './plan/project-setup-plan-review-parts.css'

const PROGRESS_SLOTS = {
  row: 'group/step flex min-h-14 items-center gap-3 border-b px-3.5 py-2.5 text-muted-foreground last:border-b-0 data-[status=running]:bg-muted/20 data-[status=waiting]:bg-muted/30',
  mark: 'grid size-8 shrink-0 place-items-center rounded-md transition-colors',
  title: 'block onboarding-title',
  detail: 'mt-0.5 block onboarding-detail text-muted-foreground',
}

const PROGRESS_TONE = {
  pending: 'neutral',
  running: 'success',
  'waiting-for-user': 'warning',
  passed: 'success',
  failed: 'danger',
} as const satisfies Record<ProgressRow['status'], keyof typeof statusToneRecipe>

const PLANNING_TASKS = [
  'inspect-folder',
  'identify-targets',
  'resolve-commands',
  'audit-setup',
  'recommend-capabilities',
  'define-verification',
] as const

type ProgressRow = {
  id: string
  message: string
  status: ProjectSetupSnapshot['progress'][number]['status']
  title: string
}

export function Progress({
  command,
  snapshot,
}: {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}) {
  const { t } = useTranslation('projects')
  const planningRows = PLANNING_TASKS.map((id) => ({
    id,
    message: t(`setup.task.${id}.detail`),
    title: t(`setup.task.${id}.label`),
  }))
  const progress = progressRows(snapshot, planningRows)
  const active = progress.find((step) => step.status === 'running')
  return (
    <div className="mt-8 max-w-2xl">
      <p className="onboarding-title text-muted-foreground" role="status">
        <RunningText running>{active?.message ?? t('setup.actor.busy')}</RunningText>
      </p>
      <ol
        className="mt-7 overflow-hidden rounded-xl border bg-card"
        aria-label={t('setup.actor.progressLabel')}
      >
        {progress.map((step) => (
          <li
            className={PROGRESS_SLOTS.row}
            data-status={taskListStatus(step.status)}
            key={step.id}
          >
            <span
              className={cn(
                PROGRESS_SLOTS.mark,
                statusToneRecipe[PROGRESS_TONE[step.status]],
                PROGRESS_TONE[step.status] === 'neutral' && indicatorToneRecipe.neutral,
              )}
            >
              <ProgressIcon status={step.status} />
            </span>
            <span className="min-w-0 flex-1">
              <strong
                className={cn(
                  PROGRESS_SLOTS.title,
                  indicatorToneRecipe[PROGRESS_TONE[step.status]],
                )}
              >
                {step.title}
              </strong>
              <small className={PROGRESS_SLOTS.detail}>{step.message}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 onboarding-action-row">
        <Button onClick={() => void command({ type: 'cancel-setup' })} variant="outline">
          {t('setup.actor.cancelAction')}
        </Button>
      </div>
    </div>
  )
}

function progressRows(
  snapshot: ProjectSetupSnapshot,
  planningRows: Array<Pick<ProgressRow, 'id' | 'message' | 'title'>>,
): ProgressRow[] {
  if (snapshot.screen !== 'planning') {
    return snapshot.progress.map((step) => ({
      id: step.stepId,
      message: step.message,
      status: step.status,
      title: step.stepId,
    }))
  }
  return planningRows.map((task, index) => {
    const step = snapshot.progress[index]
    return {
      id: task.id,
      message: step?.message ?? task.message,
      status: step?.status ?? 'pending',
      title: task.title,
    }
  })
}

function taskListStatus(status: ProgressRow['status']) {
  return status === 'waiting-for-user' ? 'waiting' : status
}

function ProgressIcon({ status }: Pick<ProgressRow, 'status'>) {
  switch (status) {
    case 'pending':
      return <Icon name="setup-step-pending" size="control" />
    case 'running':
      return <Icon name="loading" className="animate-spin" size="control" />
    case 'waiting-for-user':
      return <Icon name="setup-step-pending" size="control" />
    case 'passed':
      return <Icon name="success" size="control" />
    case 'failed':
      return <Icon name="octagon-alert" size="control" />
  }
}
