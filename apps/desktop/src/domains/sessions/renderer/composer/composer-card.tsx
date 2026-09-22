import type { LexicalEditor } from 'lexical'
import type { DragEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import { ComposerEditorArea } from '@/domains/sessions/renderer/composer/composer-editor-area'
import { ComposerToolbar } from '@/domains/sessions/renderer/composer/composer-toolbar'
import type { TurnSetupControlProps } from '@/domains/sessions/renderer/composer/run-setup-menu'
import { SessionContextBar } from '@/domains/sessions/renderer/composer/session-context-bar'
import type {
  ComposerAttachment,
  ComposerTicketContext,
} from '@/domains/sessions/renderer/composer/use-composer-store'
import type { WorkspaceMenuControlProps } from '@/domains/sessions/renderer/composer/workspace-menu'
import { DraftContextPicker } from '@/domains/sessions/renderer/context/draft-context-picker'
import type { HarnessControl } from '@/domains/sessions/renderer/harness/harnesses'

type ComposerCardProps = {
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  contextPickerOpen: boolean
  contextTokens: number | null | undefined
  contextWindowTokens: number | null | undefined
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
  onCompact?: () => Promise<boolean>
  onDropFiles: (files: FileList) => void
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  onRemoveAttachment: (id: string) => void
  onSend: () => void
  plan: SessionPlan | null
  sessionId: string
  setup: TurnSetupControlProps | null
  workspace: WorkspaceMenuControlProps | null
}

function closeContextPicker(
  editorRef: RefObject<LexicalEditor | null>,
  onOpenChange: (open: boolean) => void,
) {
  onOpenChange(false)
  editorRef.current?.focus()
}

function dropFiles(event: DragEvent<HTMLFieldSetElement>, onDropFiles: (files: FileList) => void) {
  event.preventDefault()
  if (event.dataTransfer.files.length > 0) onDropFiles(event.dataTransfer.files)
}

// The card and the context bar pinned under it: everything below the pending-turns list.
export function ComposerCard({
  attachments,
  tickets,
  contextPickerOpen,
  contextTokens,
  contextWindowTokens,
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
  onCompact,
  onDropFiles,
  onHandoff,
  onInterrupt,
  onRemoveAttachment,
  onSend,
  plan,
  sessionId,
  setup,
  workspace,
}: ComposerCardProps) {
  const { t } = useTranslation('sessions')
  return (
    <div className="relative">
      {/* The editor takes the focus but the card wears the ring, so the ring follows the card's
          radius instead of boxing the bare text area (#2273). */}
      <fieldset
        aria-label={t('composer.cardLabel')}
        data-component="ComposerCard"
        className={`@container relative z-10 flex min-w-0 flex-col overflow-visible rounded-xl border border-border bg-card shadow-(--shadow-surface) has-[[data-keyboard-focus=true]]:ring-2 has-[[data-keyboard-focus=true]]:ring-ring${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}${disabled ? ' opacity-60' : ''}`}
        onDragOver={(event: DragEvent<HTMLFieldSetElement>) => event.preventDefault()}
        onDrop={(event) => dropFiles(event, onDropFiles)}
      >
        <ComposerEditorArea
          attachments={attachments}
          contextPickerOpen={contextPickerOpen}
          tickets={tickets}
          harness={harness?.harness ?? null}
          draft={draft}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onChange={onChange}
          onRemoveAttachment={onRemoveAttachment}
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
          workspace={workspace}
        />
      </fieldset>
      {contextPickerOpen ? (
        <DraftContextPicker
          draft={draft}
          onAddTicket={onAddTicket}
          onAttach={onAttach}
          onClose={() => closeContextPicker(editorRef, onContextPickerOpenChange)}
          editorRef={editorRef}
        />
      ) : null}
      <div className="absolute inset-x-(--spacing-shell-gutter) top-full z-0 -mt-2">
        <SessionContextBar
          contextTokens={contextTokens}
          contextWindowTokens={contextWindowTokens}
          harness={harness?.harness}
          isCompacting={isCompacting}
          isHandingOff={isHandingOff}
          onCompact={onCompact}
          onHandoff={onHandoff}
        />
      </div>
    </div>
  )
}
