import { useTranslation } from 'react-i18next'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { HarnessLogo } from '@/domains/sessions/renderer'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Card, CardContent } from '@/platform/renderer/components/ui/card'
import { useHarnessSignIn } from '../hooks/use-harness-sign-in'
import { HarnessStateBody, STATE_BADGE_VARIANT } from './harness-readiness-row'

// One card per Harness, wired to its own sign-in attempt, so the panel below stays presentational:
// it only ever hands out a `HarnessReadiness`, never a mutation.
function HarnessSignInCard({ readiness }: { readiness: HarnessReadiness }) {
  const { t } = useTranslation('harnessSignIn')
  const signIn = useHarnessSignIn(readiness.harness)
  const name = t(`harness.${readiness.harness}`)
  return (
    <li className="w-60 min-w-0 list-none">
      <Card className="h-full">
        <CardContent className="grid justify-items-start gap-(--spacing-shell-item) text-left">
          <div className="flex w-full items-center gap-(--spacing-shell-icon)">
            <HarnessLogo harness={readiness.harness} />
            <span className="type-heading min-w-0 truncate">{name}</span>
            <Badge className="ml-auto" variant={STATE_BADGE_VARIANT[readiness.state]}>
              {t(`row.state.${readiness.state}`)}
            </Badge>
          </div>
          <HarnessStateBody readiness={readiness} signIn={signIn} />
        </CardContent>
      </Card>
    </li>
  )
}

// The Roster's empty state has exactly two Harnesses to offer, always (Claude, Codex), so both
// sit side by side rather than behind a picker: comparing them and acting on either takes one
// glance and one click instead of a select-then-act two-step (#2579).
export function HarnessSignInCards({ harnesses }: { harnesses: HarnessReadiness[] }) {
  const { t } = useTranslation('harnessSignIn')
  return (
    <ul
      aria-label={t('list.label')}
      className="flex w-full flex-wrap items-stretch justify-center gap-(--spacing-shell-item)"
    >
      {harnesses.map((readiness) => (
        <HarnessSignInCard key={readiness.harness} readiness={readiness} />
      ))}
    </ul>
  )
}
