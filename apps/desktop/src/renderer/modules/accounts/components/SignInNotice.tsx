import { Info } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'

export type SignInNoticeProps = { onConnect: () => void; onDismiss: () => void }

// Shown to everyone once (#1763): only a keychain read could tell who had Accounts in the Swift app.
// A card above the sidebar's GitHub foot, beside the Account it asks the person to connect.
export function SignInNotice({ onConnect, onDismiss }: SignInNoticeProps) {
  return (
    <Alert
      aria-label="GitHub sign-in notice"
      className="mx-(--spacing-shell-item) mb-(--spacing-shell-item) w-auto shrink-0 bg-muted/40"
      role="region"
    >
      <Info aria-hidden="true" />
      <AlertTitle>Connect GitHub again</AlertTitle>
      <AlertDescription className="grid gap-(--spacing-shell-item)">
        <p>
          This version of Argo keeps its own GitHub sign-in. Accounts from the earlier Argo app are
          not carried over.
        </p>
        <div className="flex gap-(--spacing-shell-item)">
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
