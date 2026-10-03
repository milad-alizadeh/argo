import { Trans, useTranslation } from 'react-i18next'
import type { Harness } from '@/harnesses/harness'
import { HARNESS_PRESENTATIONS } from '@/harnesses/presentation-registry'
import { contextZone } from './context-zone'

export function ContextDetails({
  capacityTokens,
  harness,
  percentage,
  usedTokens,
}: {
  capacityTokens: number | null
  harness: Harness
  percentage: number | null
  usedTokens: number
}) {
  const { t } = useTranslation('sessions')
  const zone = contextZone(percentage ?? 0)
  const capacityReported = capacityTokens !== null && percentage !== null
  const HarnessDetails = HARNESS_PRESENTATIONS[harness].ContextDetails
  return (
    <>
      <div className="grid gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-lg font-semibold tabular-nums">
            {t('composer.contextWindow.tokenCount', { count: Math.round(usedTokens / 1000) })}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              {capacityReported
                ? t('composer.contextWindow.capacity', {
                    count: Math.round(capacityTokens / 1000),
                  })
                : t('composer.contextWindow.tokens')}
            </span>
          </div>
          {capacityReported ? (
            <span className={`text-sm font-medium ${zone.text}`}>
              {t('composer.contextWindow.used', { percentage, zone: zone.label })}
            </span>
          ) : null}
        </div>
        {capacityReported ? (
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`absolute inset-y-0 left-0 ${percentage < 20 ? 'bg-status-success' : 'bg-destructive'}`}
              style={{ width: `${percentage}%` }}
            />
            <div className="absolute inset-y-0 w-px bg-card" style={{ left: '20%' }} />
          </div>
        ) : (
          <p className="text-muted-foreground">{t('composer.contextWindow.unreported')}</p>
        )}
        <div className="grid gap-3 border-t pt-3">
          <dl className="grid gap-2">
            <div>
              <dt className="font-medium">{t('composer.contextWindow.smartZoneRange')}</dt>
              <dd className="text-muted-foreground">
                {t('composer.contextWindow.smartZoneDescription')}
              </dd>
            </div>
            <div>
              <dt className="font-medium">{t('composer.contextWindow.dumbZoneRange')}</dt>
              <dd className="text-muted-foreground">
                {t('composer.contextWindow.dumbZoneDescription')}
              </dd>
            </div>
          </dl>
          <p className="text-muted-foreground">
            <Trans
              ns="sessions"
              i18nKey="composer.contextWindow.description"
              values={{ dex: t('composer.contextWindow.dexHorthy') }}
              components={{
                dex: (
                  <a
                    className="underline underline-offset-2"
                    href="https://www.youtube.com/watch?v=rmvDxxNubIg&t=355s"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('composer.contextWindow.dexHorthy')}
                  </a>
                ),
              }}
            />
          </p>
        </div>
      </div>
      {HarnessDetails ? <HarnessDetails capacityTokens={capacityTokens} /> : null}
    </>
  )
}
