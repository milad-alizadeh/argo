import { useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type {
  AccountChallenge,
  AccountConnected,
  Provider,
} from '@/domains/accounts/contract/contract'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import { useContractText } from '@/platform/renderer/i18n/contract-text'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import { providerPresentation } from '@/providers/presentation-registry'
import type { SignIn } from '../hooks/use-sign-in'

export type SignedIn = { login: string; outcome: AccountConnected['outcome'] }
export type SignInPanelProps = Omit<SignIn, 'connected'> & {
  connected: SignedIn | null
  // The providers this build can sign in to, in the order their buttons are drawn.
  providers: Provider[]
}

function ConnectedLine({ login, outcome }: SignedIn) {
  return (
    <p className="type-body" role="status">
      <Trans
        components={{ name: <span className="type-heading" /> }}
        i18nKey={`signIn.${outcome}`}
        ns="accounts"
        values={{ login }}
      />
    </p>
  )
}

type StepProps = { challenge: AccountChallenge; onOpen: () => void; onCancel: () => void }

// A device code is typed on the provider's page; browser consent needs only the person's consent.
function WaitingStep({ challenge, onOpen, onCancel }: StepProps) {
  const { t } = useTranslation('accounts')
  const { provider } = challenge
  const { name, challenge: step, open } = providerPresentation(provider)
  return (
    <div className="grid gap-(--spacing-shell-gutter) rounded-lg bg-muted/60 p-(--spacing-shell-inset)">
      <p className="type-body text-muted-foreground">{step}</p>
      <div className="grid gap-(--spacing-shell-tight)">
        {challenge.kind === 'device-code' ? (
          <output
            aria-label={t('signIn.codeLabel', { provider: name })}
            className="type-title font-mono tracking-widest"
          >
            {challenge.userCode}
          </output>
        ) : null}
        <p className="type-meta text-muted-foreground" role="status">
          {t('signIn.waiting', { provider: name })}
        </p>
      </div>
      <div className="flex flex-wrap gap-(--spacing-shell-item)">
        <Button onClick={onOpen}>
          <Icon name="open-external" />
          {open}
        </Button>
        <Button onClick={onCancel} variant="ghost">
          {t('signIn.cancel')}
        </Button>
      </div>
    </div>
  )
}

function ConnectButtons({ providers, phase, provider, start }: SignInPanelProps) {
  // Subscribes to a language change, which the presentation's text does not.
  useTranslation('providers')
  return (
    <div className="flex flex-wrap gap-(--spacing-shell-item)">
      {providers.map((candidate) => {
        const asking = phase === 'requesting' && provider === candidate
        const { requesting, connect } = providerPresentation(candidate)
        return (
          <Button
            disabled={phase === 'requesting'}
            key={candidate}
            onClick={() => start(candidate)}
            variant="outline"
          >
            <Icon name="connect" />
            {asking ? requesting : connect}
          </Button>
        )
      })}
    </div>
  )
}

export function SignInPanel(props: SignInPanelProps) {
  const { phase, challenge, connected, error, openProvider, cancel } = props
  const { t } = useTranslation('accounts')
  const contractText = useContractText()
  const panel = useRef<HTMLElement>(null)
  // Each step replaces the control that started it.
  useFocusRescue(panel, phase)
  return (
    <section
      aria-label={t('signIn.label')}
      className="grid gap-(--spacing-shell-gutter)"
      ref={panel}
    >
      {error ? (
        <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
          <Icon name="triangle-alert" />
          <AlertDescription>{contractText(error)}</AlertDescription>
        </Alert>
      ) : null}
      {phase === 'connected' && connected ? <ConnectedLine {...connected} /> : null}
      {phase === 'waiting' && challenge ? (
        <WaitingStep challenge={challenge} onCancel={cancel} onOpen={openProvider} />
      ) : (
        <ConnectButtons {...props} />
      )}
    </section>
  )
}
