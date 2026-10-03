import { cn } from 'cn'
import { useTranslation } from 'react-i18next'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { HarnessLogo } from '@/domains/sessions/renderer'
import { harnessShortLabel } from '@/harnesses/presentation-registry'
import { ContractFailureAlert } from '@/platform/renderer/components/contract-failure-alert'
import {
  readinessBodyRecipe,
  readinessDetailRecipe,
  readinessHeaderRecipe,
  readinessRowRecipe,
  readinessTitleRecipe,
} from '@/platform/renderer/components/design-system/readiness-row-recipes'
import { indicatorToneRecipe } from '@/platform/renderer/components/design-system/tone-recipes'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import { type HarnessSignIn, useHarnessSignIn } from '../hooks'

export const STATE_BADGE_VARIANT = {
  ready: 'secondary',
  'signed-out': 'outline',
  missing: 'outline',
  'policy-blocked': 'destructive',
} as const satisfies Record<HarnessReadiness['state'], string>

const OUTCOME_STATUSES = ['canceled', 'expired', 'failed'] as const
type OutcomeStatus = (typeof OUTCOME_STATUSES)[number]

function isOutcome(status: string): status is OutcomeStatus {
  return (OUTCOME_STATUSES as readonly string[]).includes(status)
}

function SignInArea({ name, signIn }: { name: string; signIn: HarnessSignIn }) {
  const { t } = useTranslation('harnessSignIn')
  // `wait` only ever settles into 'ready' or one of these three, since it blocks until the
  // attempt is over; 'ready' never reaches here because the row would show no CTA at all.
  const outcome =
    signIn.resolved && isOutcome(signIn.resolved.status) ? signIn.resolved.status : null
  return (
    <div className={readinessBodyRecipe}>
      {signIn.error ? <ContractFailureAlert error={signIn.error} /> : null}
      {signIn.isPending ? (
        <div className="flex flex-wrap items-center gap-(--spacing-shell-item)">
          <p className={readinessDetailRecipe} role="status">
            {t('row.waiting', { harness: name })}
          </p>
          <Button onClick={signIn.cancel} size="sm" variant="ghost">
            {t('row.cancel')}
          </Button>
        </div>
      ) : (
        <Button onClick={signIn.start} size="sm" variant="outline">
          {t('row.signIn')}
        </Button>
      )}
      {outcome ? (
        <p className={cn(readinessDetailRecipe, indicatorToneRecipe.danger)} role="status">
          {t(`row.outcome.${outcome}`)}
        </p>
      ) : null}
    </div>
  )
}

type HarnessReadinessRowProps = {
  readiness: HarnessReadiness
  signIn: HarnessSignIn
}

// The state alone decides what a Harness offers: a CTA only makes sense signed out, `detail` is
// the only thing worth saying while blocked by policy, and `missing` has nothing to sign in to
// yet. Shared by the row (a list item) and the picker (a standalone panel) so the two draw the
// same state body from the same rule.
export function HarnessStateBody({
  readiness,
  signIn,
}: {
  readiness: HarnessReadiness
  signIn: HarnessSignIn
}) {
  const { t } = useTranslation('harnessSignIn')
  const { harness, state, detail } = readiness
  const name = harnessShortLabel(harness)
  if (state === 'missing') {
    return <p className={readinessDetailRecipe}>{t('row.install', { harness: name })}</p>
  }
  if (state === 'policy-blocked') {
    return <p className={readinessDetailRecipe}>{detail ?? t('row.state.policy-blocked')}</p>
  }
  if (state === 'signed-out') {
    return <SignInArea name={name} signIn={signIn} />
  }
  return null
}

function HarnessReadinessRow({ readiness, signIn }: HarnessReadinessRowProps) {
  const { t } = useTranslation('harnessSignIn')
  const { harness, state } = readiness
  const name = harnessShortLabel(harness)
  return (
    <li
      aria-label={t('row.label', { harness: name, state: t(`row.state.${state}`) })}
      className={readinessRowRecipe}
    >
      <div className={readinessHeaderRecipe}>
        <HarnessLogo harness={harness} />
        <span className={readinessTitleRecipe}>{name}</span>
        <Badge variant={STATE_BADGE_VARIANT[state]}>{t(`row.state.${state}`)}</Badge>
      </div>
      <HarnessStateBody readiness={readiness} signIn={signIn} />
    </li>
  )
}

// Wires one Harness's row to its own sign-in attempt, so the list below stays presentational: it
// only ever hands out `HarnessReadiness` values, never a mutation.
function HarnessSignInRow({ readiness }: { readiness: HarnessReadiness }) {
  const signIn = useHarnessSignIn(readiness.harness)
  return <HarnessReadinessRow readiness={readiness} signIn={signIn} />
}

// The one list markup the Roster's empty state and the Accounts dialog's Agent sign-ins section
// both render, so a Harness row is never drawn twice (#2579).
export function HarnessReadinessList({ harnesses }: { harnesses: HarnessReadiness[] }) {
  const { t } = useTranslation('harnessSignIn')
  return (
    <ul
      aria-label={t('list.label')}
      className="grid w-full divide-y divide-border rounded-lg border border-border"
    >
      {harnesses.map((readiness) => (
        <HarnessSignInRow key={readiness.harness} readiness={readiness} />
      ))}
    </ul>
  )
}
