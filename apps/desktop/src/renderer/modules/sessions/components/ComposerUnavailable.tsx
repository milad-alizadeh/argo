import { CircleAlertIcon, InfoIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Session } from '../types'

export const COMPOSER_AVAILABILITIES = ['observed', 'read-only', 'orphaned', 'ended'] as const

export type ComposerAvailability = (typeof COMPOSER_AVAILABILITIES)[number]

const availabilityByPosture: Record<Session['posture'], ComposerAvailability> = {
  managed: 'observed',
  external: 'read-only',
  orphaned: 'orphaned',
}

export function deriveComposerAvailability(session: Session | null): ComposerAvailability | null {
  if (session === null) return null
  if (session.status === 'ended') return 'ended'
  return availabilityByPosture[session.posture]
}

export function ComposerUnavailable({ availability }: { availability: ComposerAvailability }) {
  const { t } = useTranslation()
  const Icon = availability === 'ended' ? InfoIcon : CircleAlertIcon

  return (
    <section
      aria-label={t('composer.unavailable.label')}
      className="flex h-(--size-composer-unavailable) flex-none items-center gap-tight border-t bg-sidebar px-wide text-body text-quiet"
      data-component="ComposerUnavailable"
      data-state={availability}
    >
      <Icon aria-hidden="true" className="size-[var(--size-state-dot)] flex-none" />
      <p>{t(`composer.unavailable.${availability}`)}</p>
    </section>
  )
}
