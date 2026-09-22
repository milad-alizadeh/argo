import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { providerPresentation } from '@/domains/accounts/renderer'
import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { ConnectionStatusMark } from '@/domains/tickets/renderer/connection/connection-status-mark'
import { Icon } from '@/platform/renderer/components/icon'
import { Loader } from '@/platform/renderer/components/loader'
import { Alert, AlertDescription } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/platform/renderer/components/ui/item'
import { useContractText } from '@/platform/renderer/i18n/contract-text'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

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
  const { t } = useTranslation('tickets')
  if (connection === undefined) {
    return (
      <Item role="status" variant="outline">
        <ItemMedia className={mediaTile} variant="icon">
          <Loader aria-hidden={true} />
        </ItemMedia>
        <ItemContent>
          <ItemDescription className="type-meta">{t('settings.loading')}</ItemDescription>
        </ItemContent>
      </Item>
    )
  }
  if (connection === null) {
    return (
      <Item className="border-dashed" variant="outline">
        <ItemMedia className={mediaTile} variant="icon">
          <Icon name="ticket-source" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="type-control">{t('settings.none.title')}</ItemTitle>
          <ItemDescription className="type-meta">{t('settings.none.description')}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            aria-label={t('settings.none.connectLabel')}
            className="type-control"
            onClick={onConnect}
            size="sm"
          >
            {t('settings.none.connect')}
          </Button>
        </ItemActions>
      </Item>
    )
  }
  const { name, scope } = providerPresentation(connection.provider)
  return (
    <Item variant="outline">
      <ItemMedia className={mediaTile} variant="icon">
        <Icon name="ticket-source" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="type-control max-w-full truncate">{connection.label}</ItemTitle>
        <ItemDescription className="type-meta flex items-center gap-(--spacing-shell-icon)">
          <ConnectionStatusMark state={connection.state}>
            {t('settings.readThrough', {
              name,
              login: connection.login ?? t('settings.noAccount'),
            })}
          </ConnectionStatusMark>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          aria-label={t('settings.disconnect', { scope: scope.one })}
          className="type-control"
          disabled={disconnecting}
          onClick={onDisconnect}
          size="sm"
          variant="outline"
        >
          {t('settings.disconnectButton')}
        </Button>
      </ItemActions>
    </Item>
  )
}

// The one GitHub repository or Linear team a Project reads its Tickets from (CONTEXT.md · Connection).
export function SourceSettings(props: SourceSettingsProps) {
  const { t } = useTranslation('tickets')
  const contractText = useContractText()
  const section = useRef<HTMLElement>(null)
  // Disconnecting removes the control that did it.
  useFocusRescue(section, props.connection === null)
  return (
    <section
      aria-label={t('settings.sourceLabel')}
      className="grid gap-(--spacing-shell-item)"
      ref={section}
    >
      <div className="grid gap-(--spacing-shell-tight)">
        <h3 className="type-control">{t('settings.heading')}</h3>
        <p className="type-meta text-muted-foreground">{t('settings.description')}</p>
      </div>
      <Source {...props} />
      {props.error ? (
        <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
          <Icon name="triangle-alert" />
          <AlertDescription>{contractText(props.error)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
