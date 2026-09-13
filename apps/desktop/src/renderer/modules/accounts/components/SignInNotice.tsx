import { Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'

export type SignInNoticeProps = { onConnect: () => void; onDismiss: () => void }

// Shown to everyone once (#1763): only a keychain read could tell who had Accounts in the Swift app.
// A card above the sidebar's Account foot, beside the Accounts it asks the person to connect.
export function SignInNotice({ onConnect, onDismiss }: SignInNoticeProps) {
  return (
    <Alert
      aria-label="Sign-in notice"
      className="mx-(--spacing-shell-item) mb-(--spacing-shell-item) w-auto shrink-0 bg-muted/40"
      role="region"
    >
      <Info aria-hidden="true" />
      <AlertTitle>Connect your Accounts again</AlertTitle>
      <AlertDescription className="grid gap-(--spacing-shell-item)">
        <p>
          This version of Argo keeps its own GitHub and Linear sign-ins. Accounts from the earlier
          Argo app are not carried over.
        </p>
        <div className="flex gap-(--spacing-shell-item)">
          <Button onClick={onConnect} size="sm">
            Connect an Account
          </Button>
          <Button onClick={onDismiss} size="sm" variant="ghost">
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
