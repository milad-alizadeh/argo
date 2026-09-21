import { useTranslation } from 'react-i18next'
import type { PlanEntryStatus, SessionPlan } from '@/domains/sessions/contract/model/models'
import { Icon } from '@/platform/renderer/components/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/platform/renderer/components/ui/popover'
import { Progress } from '@/platform/renderer/components/ui/progress'

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

function currentStep(plan: Extract<SessionPlan, { state: 'available' }>) {
  const active = plan.entries.findIndex((entry) => entry.status === 'in_progress')
  if (active !== -1) return active + 1
  return plan.entries.filter((entry) => entry.status === 'completed').length
}

function planProgress(plan: Extract<SessionPlan, { state: 'available' }>) {
  if (plan.entries.length === 0) return 0
  return (
    (plan.entries.filter((entry) => entry.status !== 'pending').length / plan.entries.length) * 100
  )
}

function PlanTriggerLabel({ plan }: { plan: Extract<SessionPlan, { state: 'available' }> }) {
  const { t } = useTranslation('sessions')
  if (plan.entries.length === 0) return <>{t('composer.taskPlan.triggerEmpty')}</>
  return <>{t('composer.plan', { current: currentStep(plan), total: plan.entries.length })}</>
}

function AvailablePlan({ plan }: { plan: Extract<SessionPlan, { state: 'available' }> }) {
  const { t } = useTranslation('sessions')
  const progressed = plan.entries.filter((entry) => entry.status !== 'pending').length
  const percentage = (progressed / plan.entries.length) * 100
  return (
    <>
      <PopoverHeader>
        <PopoverTitle>
          {t('composer.plan', { current: currentStep(plan), total: plan.entries.length })}
        </PopoverTitle>
      </PopoverHeader>
      <Progress value={percentage} className="h-1.5" />
      <ol aria-label={t('composer.taskPlan.label')} className="grid gap-1">
        {plan.entries.map((entry, index) => (
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
    </>
  )
}

function PlanContent({ plan }: { plan: Extract<SessionPlan, { state: 'available' }> }) {
  const { t } = useTranslation('sessions')
  if (plan.entries.length === 0) {
    return (
      <PopoverHeader>
        <PopoverTitle>{t('composer.taskPlan.emptyTitle')}</PopoverTitle>
        <p className="text-meta text-muted-foreground">{t('composer.taskPlan.emptyDescription')}</p>
      </PopoverHeader>
    )
  }
  return <AvailablePlan plan={plan} />
}

export function SessionPlanPopover({ plan }: { plan: SessionPlan | null }) {
  const { t } = useTranslation('sessions')
  if (plan?.state !== 'available') return null
  const progress = planProgress(plan)
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-(--size-composer-plan-trigger) gap-1.5 rounded-full !bg-card px-2.5 type-control"
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
            strokeDasharray={`${progress} 100`}
          />
        </svg>
        <PlanTriggerLabel plan={plan} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-80 gap-3 p-3"
        data-plan-state={plan.state}
      >
        <PlanContent plan={plan} />
      </PopoverContent>
    </Popover>
  )
}
