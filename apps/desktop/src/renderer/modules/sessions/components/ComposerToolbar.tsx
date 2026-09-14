import { ArrowUp, Paperclip, Plus, Square } from 'lucide-react'
import type { Ref } from 'react'

import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { InputGroupButton } from '../../../components/ui/input-group'
import type { HarnessControl } from '../harness/harnesses'
import type { ComposerAttachment } from '../state/useComposerStore'
import { ModeMenu } from './ModeMenu'
import { RunSetupMenu, type TurnSetupControlProps } from './RunSetupMenu'

// Extracted from the composer prototype's AddContextMenu (602bcce2), which also offers file,
// folder and command references; #1845 only builds the Attachment path those other options need.
function AddAttachmentMenu({ onAttach }: { onAttach: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton aria-label="Add context" size="icon-sm" variant="ghost" />}
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add context</DropdownMenuLabel>
          <DropdownMenuItem onClick={onAttach}>
            <Paperclip />
            Attachment
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
      <AddAttachmentMenu onAttach={onAttach} />
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
