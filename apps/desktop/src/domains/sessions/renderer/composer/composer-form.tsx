import type { LexicalEditor } from 'lexical'
import { type ReactNode, type RefObject, useEffect, useRef } from 'react'

import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import { ComposerCard } from '@/domains/sessions/renderer/composer/composer-card'
import type { TurnSetupControlProps } from '@/domains/sessions/renderer/composer/run-setup-menu'
import { AttachmentTray } from '@/domains/sessions/renderer/composer/tray/attachment-tray'
import { PendingTurns } from '@/domains/sessions/renderer/composer/tray/pending-turns'
import type { usePendingTurns } from '@/domains/sessions/renderer/composer/tray/use-pending-turns'
import type {
  ComposerAttachment,
  ComposerTicketContext,
} from '@/domains/sessions/renderer/composer/use-composer-store'
import type { HarnessControl } from '@/domains/sessions/renderer/harness/harnesses'

// The composer card's column; attached secondary surfaces inset from its edges.
export const COMPOSER_COLUMN = 'mx-auto w-full max-w-(--size-session-column)'

// Compacting steals focus onto Interrupt the moment it starts, so a keyboard user lands on the
// one control that matters without having to tab there.
function useFocusInterruptOnCompactStart(isCompacting: boolean) {
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)
  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])
  return interruptRef
}

type ComposerFormProps = {
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  contextPickerOpen: boolean
  disabled?: boolean
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  contextTokens: number | null | undefined
  contextWindowTokens: number | null | undefined
  isCompacting: boolean
  onAttach: () => void
  onAddTicket: (ticket: Omit<ComposerTicketContext, 'id'>) => void
  onContextPickerOpenChange: (open: boolean) => void
  isHandingOff?: boolean
  onCompact?: () => Promise<boolean>
  onHandoff?: () => Promise<boolean>
  isRunning: boolean
  onChange: (text: string) => void
  onDropFiles: (files: FileList) => void
  onEdit: (turn: ReturnType<typeof usePendingTurns>['pendingTurns'][number]) => void
  onInterrupt?: () => Promise<boolean>
  onRemove: (id: string) => void
  onSteer: (turn: ReturnType<typeof usePendingTurns>['pendingTurns'][number]) => Promise<boolean>
  onRemoveAttachment: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
  onSend: () => void
  pendingTurns: ReturnType<typeof usePendingTurns>['pendingTurns']
  permissionPrompt?: ReactNode
  plan: SessionPlan | null
  sessionId: string
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
}

export function ComposerForm({
  attachments,
  tickets,
  contextPickerOpen,
  disabled = false,
  draft,
  editorRef,
  focusOnMount,
  contextTokens,
  contextWindowTokens,
  isCompacting,
  onAttach,
  onAddTicket,
  onContextPickerOpenChange,
  isHandingOff,
  onCompact,
  onHandoff,
  isRunning,
  onChange,
  onDropFiles,
  onEdit,
  onInterrupt,
  onRemove,
  onSteer,
  onRemoveAttachment,
  onReorder,
  onSend,
  pendingTurns,
  permissionPrompt,
  plan,
  sessionId,
  harness,
  setup,
}: ComposerFormProps) {
  const interruptRef = useFocusInterruptOnCompactStart(isCompacting)
  return (
    <form
      className={`${COMPOSER_COLUMN} @container pt-(--spacing-shell-section) pb-(--spacing-session-composer-bottom)`}
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <AttachmentTray>
        {permissionPrompt}
        <PendingTurns
          turns={pendingTurns}
          onEdit={onEdit}
          onRemove={onRemove}
          onReorder={onReorder}
          onSteer={onSteer}
        />
      </AttachmentTray>
      <ComposerCard
        attachments={attachments}
        contextPickerOpen={contextPickerOpen}
        contextTokens={contextTokens}
        contextWindowTokens={contextWindowTokens}
        disabled={disabled}
        draft={draft}
        editorRef={editorRef}
        focusOnMount={focusOnMount}
        harness={harness}
        interruptRef={interruptRef}
        isCompacting={isCompacting}
        isHandingOff={isHandingOff}
        isRunning={isRunning}
        onAttach={onAttach}
        onAddTicket={onAddTicket}
        onChange={onChange}
        onCompact={onCompact}
        onDropFiles={onDropFiles}
        onHandoff={onHandoff}
        onInterrupt={onInterrupt}
        onRemoveAttachment={onRemoveAttachment}
        onSend={onSend}
        plan={plan}
        sessionId={sessionId}
        setup={setup}
        tickets={tickets}
        onContextPickerOpenChange={onContextPickerOpenChange}
      />
    </form>
  )
}
