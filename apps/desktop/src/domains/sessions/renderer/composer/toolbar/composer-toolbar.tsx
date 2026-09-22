import type { HarnessControl } from '../../harness'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'
import { ModeMenu } from './mode-menu'
import { RunSetupMenu, type TurnSetupControlProps } from './run-setup-menu'
import type { ComposerAttachment } from '../hooks'
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
  draft,
  attachments,
  disabled = false,
  onOpenContextPicker,
  harness,
  setup,
  workspace,
  isRunning,
  onInterrupt,
  interruptRef,
}: {
  draft: string
  attachments: ComposerAttachment[]
  disabled?: boolean
  onOpenContextPicker: () => void
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
  workspace: WorkspaceMenuControlProps | null
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
  interruptRef: Parameters<typeof Button>[0]['ref']
}) {
  const { t } = useTranslation('sessions')
  const [isInterrupting, setInterrupting] = useState(false)
  return (
    <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
      <AddContextButton onOpen={onOpenContextPicker} />
      {harness ? <RunSetupMenu harness={harness} setup={setup} /> : null}
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
            disabled={disabled || (!draft.trim() && attachments.length === 0)}
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
