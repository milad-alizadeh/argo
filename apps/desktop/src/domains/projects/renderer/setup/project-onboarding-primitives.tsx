import { ArrowLeft, ChevronDown } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'

export function SectionCard({
  action,
  children,
  className = '',
  collapsible = true,
  icon,
  subtitle,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  className?: string
  collapsible?: boolean
  icon: ReactNode
  subtitle?: string
  title: string
}) {
  const bodyId = useId()
  const [expanded, setExpanded] = useState(true)
  return (
    <section className={`onboarding-section-card ${className}`}>
      <div className="onboarding-section-card__header-row">
        <SectionCardHeader
          controls={collapsible ? bodyId : undefined}
          expanded={collapsible ? expanded : undefined}
          icon={icon}
          onToggle={collapsible ? () => setExpanded((current) => !current) : undefined}
          subtitle={subtitle}
          title={title}
        />
        {action ? <span className="onboarding-section-card__action">{action}</span> : null}
      </div>
      <div hidden={collapsible && !expanded} id={bodyId}>
        {children}
      </div>
    </section>
  )
}

export function SectionCardHeader({
  controls,
  expanded,
  icon,
  onToggle,
  subtitle,
  title,
}: {
  controls?: string
  expanded?: boolean
  icon: ReactNode
  onToggle?: () => void
  subtitle?: string
  title: string
}) {
  const content = (
    <>
      <span className="onboarding-section-card__icon">{icon}</span>
      <span className="min-w-0">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {onToggle ? (
        <ChevronDown
          aria-hidden="true"
          className="onboarding-section-card__chevron"
          data-expanded={expanded}
        />
      ) : null}
    </>
  )
  if (onToggle) {
    return (
      <button
        aria-controls={controls}
        aria-expanded={expanded}
        className="onboarding-section-card__header onboarding-section-card__toggle"
        onClick={onToggle}
        type="button"
      >
        {content}
      </button>
    )
  }
  return <div className="onboarding-section-card__header">{content}</div>
}

export function SubsectionHeader({ icon, title }: { icon?: ReactNode; title: string }) {
  return (
    <h3 className="onboarding-subsection-header">
      {icon ? <span>{icon}</span> : null}
      {title}
    </h3>
  )
}

export function OptionRow({
  action,
  detail,
  icon,
  title,
}: {
  action?: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  title: ReactNode
}) {
  return (
    <div className="onboarding-option-row">
      {icon ? <span className="onboarding-option-row__icon">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {action ? <span className="onboarding-option-row__action">{action}</span> : null}
    </div>
  )
}

export function BackAction({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  return (
    <Button
      aria-label={t('onboarding.back')}
      className="-ml-2 mb-3 size-9"
      onClick={controller.actions.back}
      size="icon-sm"
      variant="ghost"
    >
      <ArrowLeft />
    </Button>
  )
}
