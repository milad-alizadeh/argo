import { Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'

export type SignInNoticeProps = { onConnect: () => void; onDismiss: () => void }

// Shown to everyone once (#1763): only a keychain read could tell who had Accounts in the Swift app.
export function SignInNotice({ onConnect, onDismiss }: SignInNoticeProps) {
  return (
    <Alert aria-label="GitHub sign-in notice" role="region">
      <Info aria-hidden="true" />
      <AlertTitle>Connect GitHub again</AlertTitle>
      <AlertDescription>
        <p>
          This version of Argo keeps its own GitHub sign-in. Accounts from the earlier Argo app are
          not carried over.
        </p>
        <div className="mt-(--spacing-shell-item) flex gap-(--spacing-shell-item)">
          <Button onClick={onConnect} size="sm">
            Connect GitHub
          </Button>
          <Button onClick={onDismiss} size="sm" variant="ghost">
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
