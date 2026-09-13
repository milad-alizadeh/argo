import { ExternalLink, Plug, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import type { AccountChallenge, AccountConnected, Provider } from '@/core/accounts/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { useFocusRescue } from '../../../lib/focus-rescue'
import type { SignIn } from '../hooks/useSignIn'
import { PROVIDER_PRESENTATION } from '../lib/providers'

export type SignedIn = { login: string; outcome: AccountConnected['outcome'] }
export type SignInPanelProps = Omit<SignIn, 'connected'> & {
  connected: SignedIn | null
  // The providers this build can sign in to, in the order their buttons are drawn.
  providers: Provider[]
}

// A renewed sign-in is the same Account with a fresh grant; a new identity is a second Account.
const CONNECTED_TEXT = { added: 'Connected', renewed: 'Signed in again as' } as const

function ConnectedLine({ login, outcome }: SignedIn) {
  return (
    <p className="type-body" role="status">
      {CONNECTED_TEXT[outcome]} <span className="font-medium">{login}</span>.
    </p>
  )
}

type StepProps = { challenge: AccountChallenge; onOpen: () => void; onCancel: () => void }

// GitHub's code is typed on its page; Linear's page needs only the person's consent.
function WaitingStep({ challenge, onOpen, onCancel }: StepProps) {
  const { name } = PROVIDER_PRESENTATION[challenge.provider]
  return (
    <div className="grid gap-(--spacing-shell-gutter) rounded-lg bg-muted/60 p-(--spacing-shell-inset)">
      <p className="type-body text-muted-foreground">
        {challenge.provider === 'github'
          ? 'Enter this code on GitHub to connect an Account.'
          : 'Allow Argo in the Linear page your browser opened to connect an Account.'}
      </p>
      <div className="grid gap-(--spacing-shell-tight)">
        {challenge.provider === 'github' ? (
          <output aria-label="GitHub code" className="type-title font-mono tracking-widest">
            {challenge.userCode}
          </output>
        ) : null}
        <p className="type-meta text-muted-foreground" role="status">
          Waiting for {name}…
        </p>
      </div>
      <div className="flex flex-wrap gap-(--spacing-shell-item)">
        <Button onClick={onOpen}>
          <ExternalLink aria-hidden="true" />
          {challenge.provider === 'github' ? 'Copy code and open GitHub' : 'Open Linear again'}
        </Button>
        <Button onClick={onCancel} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  )
}

function ConnectButtons({ providers, phase, provider, start }: SignInPanelProps) {
  return (
    <div className="flex flex-wrap gap-(--spacing-shell-item)">
      {providers.map((candidate) => {
        const { name, requesting } = PROVIDER_PRESENTATION[candidate]
        const asking = phase === 'requesting' && provider === candidate
        return (
          <Button
            disabled={phase === 'requesting'}
            key={candidate}
            onClick={() => start(candidate)}
            variant="outline"
          >
            <Plug aria-hidden="true" />
            {asking ? requesting : `Connect a ${name} Account`}
          </Button>
        )
      })}
    </div>
  )
}

export function SignInPanel(props: SignInPanelProps) {
  const { phase, challenge, connected, error, openProvider, cancel } = props
  const panel = useRef<HTMLElement>(null)
  // Each step replaces the control that started it.
  useFocusRescue(panel, phase)
  return (
    <section
      aria-label="Connect an Account"
      className="grid gap-(--spacing-shell-gutter)"
      ref={panel}
    >
      {error ? (
        <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{error.message}</AlertDescription>
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
