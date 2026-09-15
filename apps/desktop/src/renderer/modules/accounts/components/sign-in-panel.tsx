import { ExternalLink, Plug, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { AccountChallenge, AccountConnected, Provider } from '@/core/accounts/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { useContractText } from '../../../i18n/contract-text'
import { useFocusRescue } from '../../../lib/focus-rescue'
import type { SignIn } from '../hooks/use-sign-in'
import { providerPresentation } from '../lib/providers'

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
        components={{ name: <span className="font-medium" /> }}
        i18nKey={`signIn.${outcome}`}
        ns="accounts"
        values={{ login }}
      />
    </p>
  )
}

type StepProps = { challenge: AccountChallenge; onOpen: () => void; onCancel: () => void }

// GitHub's code is typed on its page; Linear's page needs only the person's consent.
function WaitingStep({ challenge, onOpen, onCancel }: StepProps) {
  const { t } = useTranslation('accounts')
  const { provider } = challenge
  const { name } = providerPresentation(provider)
  return (
    <div className="grid gap-(--spacing-shell-gutter) rounded-lg bg-muted/60 p-(--spacing-shell-inset)">
      <p className="type-body text-muted-foreground">{t(`provider.${provider}.challenge`)}</p>
      <div className="grid gap-(--spacing-shell-tight)">
        {challenge.provider === 'github' ? (
          <output
            aria-label={t('provider.github.codeLabel')}
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
          <ExternalLink aria-hidden="true" />
          {t(`provider.${provider}.open`)}
        </Button>
        <Button onClick={onCancel} variant="ghost">
          {t('signIn.cancel')}
        </Button>
      </div>
    </div>
  )
}

function ConnectButtons({ providers, phase, provider, start }: SignInPanelProps) {
  const { t } = useTranslation('accounts')
  return (
    <div className="flex flex-wrap gap-(--spacing-shell-item)">
      {providers.map((candidate) => {
        const asking = phase === 'requesting' && provider === candidate
        return (
          <Button
            disabled={phase === 'requesting'}
            key={candidate}
            onClick={() => start(candidate)}
            variant="outline"
          >
            <Plug aria-hidden="true" />
            {asking
              ? providerPresentation(candidate).requesting
              : t(`provider.${candidate}.connect`)}
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
          <TriangleAlert aria-hidden="true" />
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
