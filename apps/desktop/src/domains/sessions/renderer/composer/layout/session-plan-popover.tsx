import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/platform/renderer/components/ui/popover'
import { Progress } from '@/platform/renderer/components/ui/progress'
import type { ComposerPlan, PlanEntryStatus, SessionPlan } from '../../types'

const PLAN_ENTRY_CLASS: Record<PlanEntryStatus, string> = {
  completed: 'bg-foreground text-background',
  in_progress: 'border border-foreground',
  pending: 'border text-muted-foreground',
}

const PLAN_ENTRY_TEXT_CLASS: Record<PlanEntryStatus, string> = {
  completed: '',
  in_progress: '',
  pending: 'text-muted-foreground',
}

const PLAN_ENTRY_LABEL: Record<PlanEntryStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
}

type AvailablePlan = Extract<SessionPlan, { state: 'available' }>
type Entry = AvailablePlan['entries'][number]
// What the popover draws: the steps when the Feed is open, or only their count from the row.
type PlanSteps = { current: number; total: number; progressed: number; entries: Entry[] }

function planSteps(plan: ComposerPlan | null): PlanSteps | null {
  switch (plan?.state) {
    case 'available': {
      const active = plan.entries.findIndex((entry) => entry.status === 'in_progress')
      const completed = plan.entries.filter((entry) => entry.status === 'completed').length
      return {
        current: active === -1 ? completed : active + 1,
        total: plan.entries.length,
        progressed: plan.entries.filter((entry) => entry.status !== 'pending').length,
        entries: plan.entries,
      }
    }
    case 'counted':
      if (plan.total === 0) return null
      return { current: plan.completed, total: plan.total, progressed: plan.completed, entries: [] }
    case 'malformed':
    case undefined:
      return null
  }
}

function PlanEntries({ entries }: { entries: Entry[] }) {
  const { t } = useTranslation('sessions')
  return (
    <ol aria-label={t('composer.taskPlan.label')} className="grid gap-1">
      {entries.map((entry, index) => (
        <li
          key={entry.position}
          aria-label={`${entry.content}: ${PLAN_ENTRY_LABEL[entry.status]}`}
          data-plan-status={entry.status}
          className={`flex items-center gap-2 overflow-visible rounded-md px-2 py-1.5 type-meta ${entry.status === 'in_progress' ? 'bg-muted font-medium' : ''}`}
        >
          <span
            className={`relative flex size-5 shrink-0 items-center justify-center overflow-visible rounded-full type-meta ${PLAN_ENTRY_CLASS[entry.status]}`}
          >
            {entry.status === 'in_progress' ? (
              <span className="absolute inset-0 animate-ping rounded-full border border-foreground/40 motion-reduce:animate-none" />
            ) : null}
            {entry.status === 'completed' ? (
              <Icon name="confirmed" className="size-3" />
            ) : (
              index + 1
            )}
          </span>
          <span className={PLAN_ENTRY_TEXT_CLASS[entry.status]}>{entry.content}</span>
        </li>
      ))}
    </ol>
  )
}

function PlanContent({ steps }: { steps: PlanSteps }) {
  const { t } = useTranslation('sessions')
  if (steps.total === 0) {
    return (
      <PopoverHeader>
        <PopoverTitle>{t('composer.taskPlan.emptyTitle')}</PopoverTitle>
        <p className="type-meta text-muted-foreground">{t('composer.taskPlan.emptyDescription')}</p>
      </PopoverHeader>
    )
  }
  return (
    <>
      <PopoverHeader>
        <PopoverTitle>
          {t('composer.plan', { current: steps.current, total: steps.total })}
        </PopoverTitle>
      </PopoverHeader>
      <Progress
        aria-label={t('sessionList.planProgress', {
          completed: steps.progressed,
          total: steps.total,
        })}
        value={(steps.progressed / steps.total) * 100}
        className="h-1.5"
      />
      {steps.entries.length === 0 ? null : <PlanEntries entries={steps.entries} />}
    </>
  )
}

export function SessionPlanPopover({ plan }: { plan: ComposerPlan | null }) {
  const { t } = useTranslation('sessions')
  const steps = planSteps(plan)
  if (steps === null) return null
  const percentage = steps.total === 0 ? 0 : (steps.progressed / steps.total) * 100
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-(--size-composer-plan-trigger) gap-1.5 px-2.5 text-muted-foreground"
            aria-label={t('composer.taskPlan.open')}
          />
        }
      >
        <svg viewBox="0 0 20 20" className="-rotate-90" aria-hidden="true">
          <circle
            cx="10"
            cy="10"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="2.5"
          />
          <circle
            cx="10"
            cy="10"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${percentage} 100`}
          />
        </svg>
        {steps.total === 0
          ? t('composer.taskPlan.triggerEmpty')
          : t('composer.plan', { current: steps.current, total: steps.total })}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-80 gap-3 p-3"
        data-plan-state={plan?.state}
      >
        <PlanContent steps={steps} />
      </PopoverContent>
    </Popover>
  )
}
