import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { RunningText } from '@/platform/renderer/components/running-text'
import { Button } from '@/platform/renderer/components/ui/button'

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
      <p className="type-heading text-muted-foreground" role="status">
        <RunningText running>{active?.message ?? t('setup.actor.busy')}</RunningText>
      </p>
      <ol
        className="mt-7 overflow-hidden rounded-xl border bg-card"
        aria-label={t('setup.actor.progressLabel')}
      >
        {progress.map((step) => (
          <li
            className="group/step flex min-h-14 items-center gap-3 border-b px-3.5 py-2.5 text-muted-foreground last:border-b-0 data-[status=failed]:bg-destructive/5 data-[status=failed]:text-destructive data-[status=running]:bg-muted/20 data-[status=running]:text-foreground data-[status=waiting]:bg-muted/30 data-[status=waiting]:text-foreground"
            data-status={taskListStatus(step.status)}
            key={step.id}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted transition-colors group-data-[status=passed]/step:bg-success/10 group-data-[status=passed]/step:text-success">
              <ProgressIcon status={step.status} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block type-body font-semibold">{step.title}</strong>
              <small className="mt-0.5 block type-control text-muted-foreground">
                {step.message}
              </small>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex justify-end">
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
      return <Circle className="size-4" />
    case 'running':
      return <LoaderCircle className="size-4 animate-spin" />
    case 'waiting-for-user':
      return <Circle className="size-4" />
    case 'passed':
      return <CheckCircle2 className="size-4" />
    case 'failed':
      return <Circle className="size-4" />
  }
}
