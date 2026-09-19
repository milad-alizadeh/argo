import { ArrowUp, Plus, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ModeMenu } from '@/domains/sessions/renderer/components/composer/mode-menu'
import {
  RunSetupMenu,
  type TurnSetupControlProps,
} from '@/domains/sessions/renderer/components/composer/run-setup-menu'
import type { HarnessControl } from '@/domains/sessions/renderer/harness/harnesses'
import type { ComposerAttachment } from '@/domains/sessions/renderer/state/use-composer-store'
import { Button } from '@/platform/renderer/components/ui/button'
import { InputGroupButton } from '@/platform/renderer/components/ui/input-group'

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
      <Plus />
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
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
  interruptRef: Parameters<typeof Button>[0]['ref']
}) {
  const { t } = useTranslation('sessions')
  return (
    <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
      <AddContextButton onOpen={onOpenContextPicker} />
      {harness ? <RunSetupMenu harness={harness} setup={setup} /> : null}
      <div className="ml-auto flex items-center gap-1">
        {setup ? <ModeMenu {...setup} /> : null}
        {isRunning ? (
          <Button
            aria-label={t('composer.interrupt')}
            onClick={() => void onInterrupt?.()}
            ref={interruptRef}
            size="icon-sm"
            type="button"
          >
            <Square fill="currentColor" />
          </Button>
        ) : (
          <Button
            aria-label={t('composer.sendMessage')}
            disabled={disabled || (!draft.trim() && attachments.length === 0)}
            size="icon-sm"
            type="submit"
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  )
}
