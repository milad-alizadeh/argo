import { Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'

export type SignInNoticeProps = { onConnect: () => void; onDismiss: () => void }

// Shown to everyone once (#1763): only a keychain read could tell who had Accounts in the Swift app.
// A band across the foot of the screen, so the chrome bar stays level with the sidebar's.
export function SignInNotice({ onConnect, onDismiss }: SignInNoticeProps) {
  return (
    <Alert
      aria-label="GitHub sign-in notice"
      className="shrink-0 rounded-none border-x-0 border-b-0 bg-muted/40 px-(--spacing-shell-inset) py-(--spacing-shell-gutter)"
      role="region"
    >
      <Info aria-hidden="true" />
      <AlertTitle>Connect GitHub again</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-(--spacing-shell-inset) gap-y-(--spacing-shell-item)">
        <p className="min-w-0 flex-1">
          This version of Argo keeps its own GitHub sign-in. Accounts from the earlier Argo app are
          not carried over.
        </p>
        <div className="flex shrink-0 gap-(--spacing-shell-item)">
          <Button onClick={onDismiss} size="sm" variant="ghost">
            Dismiss
          </Button>
          <Button onClick={onConnect} size="sm">
            Connect GitHub
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
