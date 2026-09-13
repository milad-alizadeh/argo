import { TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import type { ContractFailure } from '../../../lib/query-client'

// A failure the person can clear by signing in again offers that, beside reading again.
const RECONNECTABLE = new Set<ContractFailure['code']>([
  'account-revoked',
  'grant-unreadable',
  'missing-account',
])

export type TicketFailureProps = {
  title: string
  error: ContractFailure
  onRetry: () => void
  onReconnect: () => void
}

export function TicketFailure({ title, error, onRetry, onReconnect }: TicketFailureProps) {
  return (
    <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        <div className="mt-(--spacing-shell-item) flex gap-(--spacing-shell-item)">
          <Button onClick={onRetry} size="sm" variant="outline">
            Try again
          </Button>
          {RECONNECTABLE.has(error.code) ? (
            <Button onClick={onReconnect} size="sm">
              Reconnect GitHub
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  )
}
