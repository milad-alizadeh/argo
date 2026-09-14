import type { LexicalEditor } from 'lexical'
import type { DragEvent, RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { HarnessControl } from '../harness/harnesses'
import type { ComposerAttachment, ComposerTicketContext } from '../state/useComposerStore'
import { ComposerEditorArea } from './ComposerEditorArea'
import { ComposerToolbar } from './ComposerToolbar'
import { ContextPicker } from './ContextPicker'
import type { TurnSetupControlProps } from './RunSetupMenu'
import { SessionContextBar } from './SessionContextBar'

type ComposerCardProps = {
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  contextPickerOpen: boolean
  contextTokens: number | null | undefined
  disabled?: boolean
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  harness: HarnessControl | null
  interruptRef: RefObject<HTMLButtonElement | null>
  isCompacting: boolean
  isHandingOff?: boolean
  isRunning: boolean
  onAttach: () => void
  onAddTicket: (ticket: Omit<ComposerTicketContext, 'id'>) => void
  onContextPickerOpenChange: (open: boolean) => void
  onChange: (text: string) => void
  onOpenTicket?: (key: string) => void
  onCompact?: () => Promise<boolean>
  onDropFiles: (files: FileList) => void
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  onRemoveAttachment: (id: string) => void
  onRemoveTicket: (id: string) => void
  onSend: () => void
  plan: SessionPlan | null
  sessionId: string
  setup: TurnSetupControlProps | null
}

function DraftContextPicker({
  onAddTicket,
  onAttach,
  onClose,
}: Pick<ComposerCardProps, 'onAddTicket' | 'onAttach'> & {
  onClose: () => void
}) {
  return (
    <ContextPicker
      onAttach={() => {
        onClose()
        onAttach()
      }}
      onClose={onClose}
      onSelectTicket={(ticket) => {
        onAddTicket(ticket)
        onClose()
      }}
    />
  )
}

function closeContextPicker(
  editorRef: RefObject<LexicalEditor | null>,
  onOpenChange: (open: boolean) => void,
) {
  onOpenChange(false)
  editorRef.current?.focus()
}

// The card and the context bar pinned under it: everything below the pending-turns list.
export function ComposerCard({
  attachments,
  tickets,
  contextPickerOpen,
  contextTokens,
  disabled,
  draft,
  editorRef,
  focusOnMount,
  harness,
  interruptRef,
  isCompacting,
  isHandingOff,
  isRunning,
  onAttach,
  onAddTicket,
  onContextPickerOpenChange,
  onChange,
  onOpenTicket,
  onCompact,
  onDropFiles,
  onHandoff,
  onInterrupt,
  onRemoveAttachment,
  onRemoveTicket,
  onSend,
  plan,
  sessionId,
  setup,
}: ComposerCardProps) {
  return (
    <div className="relative">
      <fieldset
        aria-label="Message composer"
        data-component="ComposerCard"
        className={`@container relative z-10 flex min-w-0 flex-col overflow-visible rounded-xl border border-border bg-card shadow-(--shadow-surface)${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}${disabled ? ' opacity-60' : ''}`}
        onDragOver={(event: DragEvent<HTMLFieldSetElement>) => event.preventDefault()}
        onDrop={(event: DragEvent<HTMLFieldSetElement>) => {
          event.preventDefault()
          if (event.dataTransfer.files.length > 0) onDropFiles(event.dataTransfer.files)
        }}
      >
        <ComposerEditorArea
          attachments={attachments}
          tickets={tickets}
          cli={harness?.cli ?? null}
          draft={draft}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onChange={onChange}
          onOpenTicket={onOpenTicket}
          onRemoveAttachment={onRemoveAttachment}
          onRemoveTicket={onRemoveTicket}
          onSend={onSend}
          plan={plan}
          sessionId={sessionId}
        />
        <ComposerToolbar
          attachments={attachments}
          disabled={disabled}
          draft={draft}
          harness={harness}
          interruptRef={interruptRef}
          isRunning={isRunning}
          onOpenContextPicker={() => onContextPickerOpenChange(true)}
          onInterrupt={onInterrupt}
          setup={setup}
        />
      </fieldset>
      {contextPickerOpen ? (
        <DraftContextPicker
          onAddTicket={onAddTicket}
          onAttach={onAttach}
          onClose={() => closeContextPicker(editorRef, onContextPickerOpenChange)}
        />
      ) : null}
      <div className="absolute inset-x-(--spacing-shell-gutter) top-full z-0 -mt-2">
        <SessionContextBar
          contextTokens={contextTokens}
          harness={harness?.cli}
          isCompacting={isCompacting}
          isHandingOff={isHandingOff}
          onCompact={onCompact}
          onHandoff={onHandoff}
        />
      </div>
    </div>
  )
}
