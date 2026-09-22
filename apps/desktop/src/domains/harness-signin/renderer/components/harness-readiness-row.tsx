import { useTranslation } from 'react-i18next'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import {
  type HarnessSignIn,
  useHarnessSignIn,
} from '@/domains/harness-signin/renderer/hooks/use-harness-sign-in'
import { HarnessLogo } from '@/domains/sessions/renderer'
import { ContractFailureAlert } from '@/platform/renderer/components/contract-failure-alert'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'

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
    <div className="grid justify-items-start gap-(--spacing-shell-item)">
      {signIn.error ? <ContractFailureAlert error={signIn.error} /> : null}
      {signIn.isPending ? (
        <div className="flex flex-wrap items-center gap-(--spacing-shell-item)">
          <p className="type-meta text-muted-foreground" role="status">
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
        <p className="type-meta text-destructive" role="status">
          {t(`row.outcome.${outcome}`)}
        </p>
      ) : null}
    </div>
  )
}

export type HarnessReadinessRowProps = {
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
  const name = t(`harness.${harness}`)
  if (state === 'missing') {
    return <p className="type-meta text-muted-foreground">{t('row.install', { harness: name })}</p>
  }
  if (state === 'policy-blocked') {
    return (
      <p className="type-meta text-muted-foreground">{detail ?? t('row.state.policy-blocked')}</p>
    )
  }
  if (state === 'signed-out') {
    return <SignInArea name={name} signIn={signIn} />
  }
  return null
}

export function HarnessReadinessRow({ readiness, signIn }: HarnessReadinessRowProps) {
  const { t } = useTranslation('harnessSignIn')
  const { harness, state } = readiness
  const name = t(`harness.${harness}`)
  return (
    <li
      aria-label={t('row.label', { harness: name, state: t(`row.state.${state}`) })}
      className="grid gap-(--spacing-shell-item) p-(--spacing-shell-gutter)"
    >
      <div className="flex min-h-7 items-center gap-(--spacing-shell-item)">
        <HarnessLogo harness={harness} />
        <span className="type-heading min-w-0 truncate">{name}</span>
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
      className="grid w-full divide-y divide-border/60 rounded-lg border border-border/60"
    >
      {harnesses.map((readiness) => (
        <HarnessSignInRow key={readiness.harness} readiness={readiness} />
      ))}
    </ul>
  )
}
