import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import type { HarnessControl } from '../../harness/harnesses'
import { EMPTY_COMPOSER_ATTACHMENTS, useComposerStore } from '../hooks/use-composer-store'
import { ModeMenu } from './mode-menu'
import { type CatalogFailure, RunSetupMenu, type TurnSetupControlProps } from './run-setup-menu'
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
  sessionId,
  disabled = false,
  sendAvailable = true,
  onOpenContextPicker,
  harness,
  setup,
  catalogFailure = null,
  refreshCatalog,
  workspace,
  isRunning,
  onInterrupt,
  interruptRef,
}: {
  sessionId: string
  disabled?: boolean
  sendAvailable?: boolean
  onOpenContextPicker: () => void
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
  catalogFailure?: CatalogFailure | null
  refreshCatalog?: () => void
  workspace: WorkspaceMenuControlProps | null
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
  interruptRef: Parameters<typeof Button>[0]['ref']
}) {
  const { t } = useTranslation('sessions')
  const draft = useComposerStore(({ drafts }) => drafts[sessionId] ?? '')
  const attachments = useComposerStore(
    ({ attachments }) => attachments[sessionId] ?? EMPTY_COMPOSER_ATTACHMENTS,
  )
  const [isInterrupting, setInterrupting] = useState(false)
  return (
    <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
      <AddContextButton onOpen={onOpenContextPicker} />
      {harness ? (
        <RunSetupMenu
          harness={harness}
          setup={setup}
          catalogFailure={catalogFailure}
          refreshCatalog={refreshCatalog}
        />
      ) : null}
      {workspace ? <WorkspaceMenu {...workspace} /> : null}
      <div className="ml-auto flex items-center gap-1">
        {setup ? <ModeMenu {...setup} /> : null}
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
