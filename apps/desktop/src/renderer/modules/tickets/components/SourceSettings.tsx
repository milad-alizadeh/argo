import { BookMarked, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'

import type { ConnectionSummary } from '@/core/tickets/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '../../../components/ui/item'
import { Spinner } from '../../../components/ui/spinner'
import { useFocusRescue } from '../../../lib/focus-rescue'
import type { ContractFailure } from '../../../lib/query-client'
import { providerPresentation } from '../../accounts/lib/providers'
import { ConnectionStatusMark } from './ConnectionStatusMark'

export type SourceSettingsProps = {
  // Undefined while the Connection is read; null when the Project has none.
  connection: ConnectionSummary | null | undefined
  error: ContractFailure | null
  disconnecting: boolean
  onDisconnect: () => void
  onConnect: () => void
}

const mediaTile = 'size-8 rounded-md bg-muted text-muted-foreground'

function Source({ connection, disconnecting, onDisconnect, onConnect }: SourceSettingsProps) {
  if (connection === undefined) {
    return (
      <Item role="status" variant="outline">
        <ItemMedia className={mediaTile} variant="icon">
          <Spinner aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemDescription className="type-meta">
            Reading the connected Ticket source…
          </ItemDescription>
        </ItemContent>
      </Item>
    )
  }
  if (connection === null) {
    return (
      <Item className="border-dashed" variant="outline">
        <ItemMedia className={mediaTile} variant="icon">
          <BookMarked aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="type-label">No Ticket source connected</ItemTitle>
          <ItemDescription className="type-meta">
            Connect a GitHub repository or a Linear team.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            aria-label="Connect a Ticket source"
            className="type-label"
            onClick={onConnect}
            size="sm"
          >
            Connect
          </Button>
        </ItemActions>
      </Item>
    )
  }
  const { name, scope } = providerPresentation(connection.provider)
  return (
    <Item variant="outline">
      <ItemMedia className={mediaTile} variant="icon">
        <BookMarked aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="type-label max-w-full truncate">{connection.label}</ItemTitle>
        <ItemDescription className="type-meta flex items-center gap-(--spacing-shell-icon)">
          <ConnectionStatusMark state={connection.state}>
            Read through {name} · {connection.login ?? 'a disconnected Account'}
          </ConnectionStatusMark>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          aria-label={`Disconnect ${scope.one}`}
          className="type-label"
          disabled={disconnecting}
          onClick={onDisconnect}
          size="sm"
          variant="outline"
        >
          Disconnect
        </Button>
      </ItemActions>
    </Item>
  )
}

// The one GitHub repository or Linear team a Project reads its Tickets from (CONTEXT.md · Connection).
export function SourceSettings(props: SourceSettingsProps) {
  const section = useRef<HTMLElement>(null)
  // Disconnecting removes the control that did it.
  useFocusRescue(section, props.connection === null)
  return (
    <section aria-label="Ticket source" className="grid gap-(--spacing-shell-item)" ref={section}>
      <div className="grid gap-(--spacing-shell-tight)">
        <h3 className="type-label">Tickets</h3>
        <p className="type-meta text-muted-foreground">
          Argo reads a Project's Tickets from one GitHub repository or Linear team.
        </p>
      </div>
      <Source {...props} />
      {props.error ? (
        <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{props.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
