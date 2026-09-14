import { $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical'
import { ArrowUp, Paperclip, Plus, Square, WandSparkles } from 'lucide-react'
import type { Ref, RefObject } from 'react'

import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { InputGroupButton } from '../../../components/ui/input-group'
import type { HarnessControl } from '../harness/harnesses'
import type { ComposerAttachment } from '../state/useComposerStore'
import { ModeMenu } from './ModeMenu'
import { RunSetupMenu, type TurnSetupControlProps } from './RunSetupMenu'

// Typing "/" is what opens the composer's own slash-command menu (composer-reference-menu.tsx);
// inserting it here at the cursor reuses that menu rather than building a second one.
function openSkillsMenu(editor: LexicalEditor) {
  editor.focus(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertText('/')
    })
  })
}

// Extracted from the composer prototype's AddContextMenu (602bcce2). The prototype also offers
// separate file-reference, folder-reference and command items; here "Files & folders" covers the
// first two (both attach a real path), and "Skills" opens the same "/" menu the command item did.
function AddContextMenu({
  editorRef,
  onAttach,
}: {
  editorRef: RefObject<LexicalEditor | null>
  onAttach: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton aria-label="Add context" size="icon-sm" variant="ghost" />}
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60" side="top">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onAttach}>
            <Paperclip />
            Files & folders
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const editor = editorRef.current
              if (editor) openSkillsMenu(editor)
            }}
          >
            <WandSparkles />
            Skills
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ComposerToolbar({
  draft,
  attachments,
  disabled = false,
  editorRef,
  onAttach,
  harness,
  setup,
  isRunning,
  onInterrupt,
  interruptRef,
}: {
  draft: string
  attachments: ComposerAttachment[]
  disabled?: boolean
  editorRef: RefObject<LexicalEditor | null>
  onAttach: () => void
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
  interruptRef: Ref<HTMLButtonElement>
}) {
  return (
    <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
      <AddContextMenu editorRef={editorRef} onAttach={onAttach} />
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
