import { ExternalLink, Plug, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import type { AccountConnected } from '@/core/accounts/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { useFocusRescue } from '../../../lib/focus-rescue'
import type { SignIn } from '../hooks/useSignIn'

export type SignedIn = { login: string; outcome: AccountConnected['outcome'] }
export type SignInPanelProps = Omit<SignIn, 'connected'> & { connected: SignedIn | null }

// A renewed sign-in is the same Account with a fresh grant; a new identity is a second Account.
const CONNECTED_TEXT = { added: 'Connected', renewed: 'Signed in again as' } as const

function ConnectedLine({ login, outcome }: SignedIn) {
  return (
    <p className="type-body" role="status">
      {CONNECTED_TEXT[outcome]} <span className="font-medium">{login}</span>.
    </p>
  )
}

function CodeStep({ userCode, onOpenGitHub, onCancel }: CodeStepProps) {
  return (
    <div className="grid gap-(--spacing-shell-item)">
      <p className="type-body text-muted-foreground">
        Enter this code on GitHub to connect an Account.
      </p>
      <output aria-label="GitHub code" className="type-title font-mono tracking-widest">
        {userCode}
      </output>
      <p className="type-meta text-muted-foreground" role="status">
        Waiting for GitHub…
      </p>
      <div className="flex gap-(--spacing-shell-item)">
        <Button onClick={onOpenGitHub}>
          <ExternalLink aria-hidden="true" />
          Copy code and open GitHub
        </Button>
        <Button onClick={onCancel} variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  )
}

type CodeStepProps = { userCode: string; onOpenGitHub: () => void; onCancel: () => void }

export function SignInPanel({
  phase,
  challenge,
  connected,
  error,
  start,
  openGitHub,
  cancel,
}: SignInPanelProps) {
  const panel = useRef<HTMLElement>(null)
  // Each step replaces the control that started it.
  useFocusRescue(panel, phase)
  return (
    <section
      aria-label="Connect a GitHub Account"
      className="grid gap-(--spacing-shell-item)"
      ref={panel}
    >
      {error ? (
        <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {phase === 'connected' && connected ? <ConnectedLine {...connected} /> : null}
      {phase === 'code' && challenge ? (
        <CodeStep onCancel={cancel} onOpenGitHub={openGitHub} userCode={challenge.userCode} />
      ) : (
        <Button
          className="justify-self-start"
          disabled={phase === 'requesting'}
          onClick={start}
          variant="outline"
        >
          <Plug aria-hidden="true" />
          {phase === 'requesting' ? 'Asking GitHub for a code…' : 'Connect a GitHub Account'}
        </Button>
      )}
    </section>
  )
}
