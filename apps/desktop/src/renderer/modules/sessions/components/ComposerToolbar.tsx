import { ArrowUp, Paperclip, Square } from 'lucide-react'
import type { Ref } from 'react'

import { Button } from '../../../components/ui/button'
import { InputGroupButton } from '../../../components/ui/input-group'
import type { HarnessControl } from '../harness/harnesses'
import type { ComposerAttachment } from '../state/useComposerStore'
import { ModeMenu } from './ModeMenu'
import { RunSetupMenu, type TurnSetupControlProps } from './RunSetupMenu'

export function ComposerToolbar({
  draft,
  attachments,
  onAttach,
  harness,
  setup,
  isRunning,
  onInterrupt,
  interruptRef,
}: {
  draft: string
  attachments: ComposerAttachment[]
  onAttach: () => void
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
  interruptRef: Ref<HTMLButtonElement>
}) {
  return (
    <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
      <InputGroupButton aria-label="Attach files" onClick={onAttach} size="icon-sm">
        <Paperclip />
      </InputGroupButton>
      {harness ? <RunSetupMenu harness={harness} setup={setup} /> : null}
      <div className="ml-auto flex items-center gap-1">
        {setup ? <ModeMenu {...setup} /> : null}
        {isRunning ? (
          <Button
            aria-label="Interrupt"
            onClick={() => void onInterrupt?.()}
            ref={interruptRef}
            size="icon-sm"
            type="button"
          >
            <Square fill="currentColor" />
          </Button>
        ) : (
          <Button
            aria-label="Send message"
            disabled={!draft.trim() && attachments.length === 0}
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
