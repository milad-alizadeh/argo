import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ContractFailureAlert } from '@/platform/renderer/components/contract-failure-alert'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Loader } from '@/platform/renderer/components/loader/loader'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/platform/renderer/components/ui/item'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { cn } from '@/platform/renderer/lib/utils'
import { providerPresentation } from '@/providers/presentation-registry'
import type { ConnectionSummary } from '../hooks'
import { ConnectionStatusMark } from './connection-status-mark'

export type SourceSettingsProps = {
  // Undefined while the Connection is read; null when the Project has none.
  connection: ConnectionSummary | null | undefined
  error: ContractFailure | null
  disconnecting: boolean
  onDisconnect: () => void
  onConnect: () => void
}

const SOURCE_CONNECTION_ITEM_SLOTS = {
  media: 'size-8 rounded-md bg-muted text-muted-foreground',
  title: 'type-control',
  description: 'type-meta',
}

function SourceConnectionItem({
  connection,
  disconnecting,
  onDisconnect,
  onConnect,
}: SourceSettingsProps) {
  const { t } = useTranslation('tickets')
  if (connection === undefined) {
    return (
      <Item role="status" variant="outline">
        <ItemMedia className={SOURCE_CONNECTION_ITEM_SLOTS.media} variant="icon">
          <Loader aria-hidden={true} />
        </ItemMedia>
        <ItemContent>
          <ItemDescription className={SOURCE_CONNECTION_ITEM_SLOTS.description}>
            {t('settings.loading')}
          </ItemDescription>
        </ItemContent>
      </Item>
    )
  }
  if (connection === null) {
    return (
      <Item className="border-dashed" variant="outline">
        <ItemMedia className={SOURCE_CONNECTION_ITEM_SLOTS.media} variant="icon">
          <Icon name="ticket-source" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className={SOURCE_CONNECTION_ITEM_SLOTS.title}>
            {t('settings.none.title')}
          </ItemTitle>
          <ItemDescription className={SOURCE_CONNECTION_ITEM_SLOTS.description}>
            {t('settings.none.description')}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button aria-label={t('settings.none.connectLabel')} onClick={onConnect} size="sm">
            {t('settings.none.connect')}
          </Button>
        </ItemActions>
      </Item>
    )
  }
  const { name, scope } = providerPresentation(connection.provider)
  return (
    <Item variant="outline">
      <ItemMedia className={SOURCE_CONNECTION_ITEM_SLOTS.media} variant="icon">
        <Icon name="ticket-source" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className={cn(SOURCE_CONNECTION_ITEM_SLOTS.title, 'max-w-full truncate')}>
          {connection.label}
        </ItemTitle>
        <ItemDescription
          className={cn(
            SOURCE_CONNECTION_ITEM_SLOTS.description,
            'flex items-center gap-(--spacing-shell-icon)',
          )}
        >
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
      <SourceConnectionItem {...props} />
      {props.error ? <ContractFailureAlert error={props.error} /> : null}
    </section>
  )
}
