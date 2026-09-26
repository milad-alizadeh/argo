import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import type { HarnessControl } from '../../harness/harnesses'
import { useComposerEditing } from '../editing/composer-editing-context'
import { ModeMenu } from './mode-menu'
import {
  type CatalogFailure,
  type TurnConfigurationControlProps,
  TurnConfigurationMenu,
} from './turn-configuration-menu'
import { WorkspaceMenu, type WorkspaceMenuControlProps } from './workspace-menu'

function AddContextButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation('sessions')

  return (
    <InputGroupButton
      aria-label={t('composer.addContext')}
      onClick={onOpen}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <Icon name="add" />
    </InputGroupButton>
  )
}

export function ComposerToolbar({
  disabled = false,
  sendAvailable = true,
  onOpenContextPicker,
  harness,
  turnConfiguration,
  catalogFailure = null,
  refreshCatalog,
  workspace,
  isRunning,
  onInterrupt,
  interruptRef,
}: {
  disabled?: boolean
  sendAvailable?: boolean
  onOpenContextPicker: () => void
  harness: HarnessControl | null
  turnConfiguration: TurnConfigurationControlProps | null
  catalogFailure?: CatalogFailure | null
  refreshCatalog?: () => void
  workspace: WorkspaceMenuControlProps | null
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
  interruptRef: Parameters<typeof Button>[0]['ref']
}) {
  const { t } = useTranslation('sessions')
  const { editing } = useComposerEditing()
  const { prompt: draft, attachments } = editing
  const [isInterrupting, setInterrupting] = useState(false)
  return (
    <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
      <AddContextButton onOpen={onOpenContextPicker} />
      {harness ? (
        <TurnConfigurationMenu
          harness={harness}
          turnConfiguration={turnConfiguration}
          catalogFailure={catalogFailure}
          refreshCatalog={refreshCatalog}
        />
      ) : null}
      {workspace ? <WorkspaceMenu {...workspace} /> : null}
      <div className="ml-auto flex items-center gap-1">
        {turnConfiguration ? <ModeMenu {...turnConfiguration} /> : null}
        {isRunning ? (
          <Button
            aria-label={t('composer.interrupt')}
            disabled={isInterrupting || onInterrupt === undefined}
            onClick={() => {
              if (onInterrupt === undefined) return
              setInterrupting(true)
              void onInterrupt().finally(() => setInterrupting(false))
            }}
            ref={interruptRef}
            size="icon-sm"
            type="button"
          >
            <Icon className="size-2.5" fill="currentColor" name="interrupt" />
          </Button>
        ) : (
          <Button
            aria-label={t('composer.sendMessage')}
            disabled={disabled || !sendAvailable || (!draft.trim() && attachments.length === 0)}
            size="icon-sm"
            type="submit"
          >
            <Icon name="send" />
          </Button>
        )}
      </div>
    </div>
  )
}
