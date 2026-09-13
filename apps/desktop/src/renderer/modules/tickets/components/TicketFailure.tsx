import { TriangleAlert } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
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
  const reconnectable = RECONNECTABLE.has(error.code)
  return (
    <Empty className="h-full" role="alert">
      <EmptyHeader>
        <EmptyMedia className="text-danger" variant="icon">
          <TriangleAlert aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{error.message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={onRetry} variant={reconnectable ? 'outline' : 'default'}>
          Try again
        </Button>
        {reconnectable ? <Button onClick={onReconnect}>Reconnect GitHub</Button> : null}
      </EmptyContent>
    </Empty>
  )
}
