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
          <div className="type-title tabular-nums">
            {t('composer.contextWindow.tokenCount', { count: Math.round(usedTokens / 1000) })}{' '}
            <span className="type-body font-normal text-muted-foreground">
              {capacityReported
                ? t('composer.contextWindow.capacity', {
                    count: Math.round(capacityTokens / 1000),
                  })
                : t('composer.contextWindow.tokens')}
            </span>
          </div>
          {capacityReported ? (
            <span className={`type-heading ${zone.text}`}>
              {t('composer.contextWindow.used', { percentage, zone: zone.label })}
            </span>
          ) : null}
        </div>
        {capacityReported ? (
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-foreground/70"
              style={{ width: `${percentage}%` }}
            />
            <div className="absolute inset-y-0 w-px bg-card" style={{ left: '20%' }} />
          </div>
        ) : (
          <p className="type-prose text-muted-foreground">
            {t('composer.contextWindow.unreported')}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 type-prose">
          <div>
            <div className="font-semibold text-foreground">
              {t('composer.contextWindow.smartZoneRange')}
            </div>
            <p className="mt-1 text-muted-foreground">
              {t('composer.contextWindow.smartZoneDescription')}
            </p>
          </div>
          <div>
            <div className="font-semibold text-foreground">
              {t('composer.contextWindow.dumbZoneRange')}
            </div>
            <p className="mt-1 text-muted-foreground">
              {t('composer.contextWindow.dumbZoneDescription')}
            </p>
          </div>
          <p className="col-span-2 text-muted-foreground">
            {t('composer.contextWindow.description')}
          </p>
          <p className="col-span-2 text-muted-foreground">
            <Trans
              ns="sessions"
              i18nKey="composer.contextWindow.attribution"
              values={{
                matt: t('composer.contextWindow.mattPocock'),
                dex: t('composer.contextWindow.dexHorthy'),
              }}
              components={{
                matt: (
                  <a
                    className="underline underline-offset-2"
                    href="https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=192s"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('composer.contextWindow.mattPocock')}
                  </a>
                ),
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
