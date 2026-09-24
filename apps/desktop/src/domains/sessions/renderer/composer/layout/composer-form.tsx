import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import type { Send } from '../hooks/use-send'
import { useSessionComposerState } from '../hooks/use-session-composer-state'
import { activeReference } from '../references/composer-reference-menu'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { AttachmentTray } from '../tray/attachment-tray'
import { PendingTurns } from '../tray/pending-turns'
import { ComposerCard } from './composer-card'
import '../editor/composer-content.css'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'

export const COMPOSER_COLUMN = 'mx-auto w-full max-w-(--size-session-column)'

export type ComposerFormProps = {
  contextTokens?: number | null
  contextWindowTokens?: number | null
  disabled?: boolean
  focusOnMount?: boolean
  isCompacting?: boolean
  isHandingOff?: boolean
  isRunning?: boolean
  onCompact?: () => Promise<boolean>
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend?: Send
  onSteer?: (text: string, attachments: SessionAttachmentInput[]) => Promise<boolean>
  permissionPrompt?: ReactNode
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
  catalogError?: boolean
  refreshCatalog?: () => void
  workspace?: WorkspaceMenuControlProps | null
}

function useFocusInterruptOnCompactStart(isCompacting: boolean) {
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)
  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])
  return interruptRef
}

function useContextPicker(draft: string) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (activeReference(draft)?.trigger === '@') setOpen(true)
  }, [draft])
  return [open, setOpen] as const
}

export function ComposerForm({
  contextTokens,
  contextWindowTokens,
  disabled = false,
  focusOnMount = false,
  isCompacting = false,
  isHandingOff = false,
  isRunning = false,
  onCompact,
  onHandoff,
  onInterrupt,
  sessionId,
  onSend,
  onSteer,
  permissionPrompt,
  plan = null,
  harness = null,
  setup = null,
  catalogError = false,
  refreshCatalog,
  workspace = null,
}: ComposerFormProps) {
  const state = useSessionComposerState({ sessionId, isRunning, onSend, onSteer, setup })
  const [contextPickerOpen, setContextPickerOpen] = useContextPicker(state.draft)
  const interruptRef = useFocusInterruptOnCompactStart(isCompacting)
  const send = () => {
    if (!disabled && onSend) void state.send()
  }
  return (
    <form
      className={`${COMPOSER_COLUMN} @container pt-(--spacing-shell-section) pb-(--spacing-session-composer-bottom)`}
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <AttachmentTray>
        {permissionPrompt}
        <PendingTurns
          turns={state.pendingTurns}
          onEdit={state.onEdit}
          onRemove={state.removePendingTurn}
          onReorder={state.reorderPendingTurn}
          onSteer={state.steerPendingTurn}
        />
      </AttachmentTray>
      <ComposerCard
        attachments={state.attachments}
        contextPickerOpen={contextPickerOpen}
        contextTokens={contextTokens}
        contextWindowTokens={contextWindowTokens}
        disabled={disabled}
        draft={state.draft}
        editorRef={state.editorRef}
        focusOnMount={focusOnMount}
        harness={harness}
        interruptRef={interruptRef}
        isCompacting={isCompacting}
        isHandingOff={isHandingOff}
        isRunning={isRunning}
        onAttach={() => void state.attachFiles()}
        onAddTicket={state.addTicket}
        onChange={state.changeDraft}
        onCompact={onCompact}
        onDropFiles={state.dropFiles}
        onHandoff={onHandoff}
        onInterrupt={onInterrupt}
        onRemoveAttachment={state.removeAttachment}
        onSend={send}
        plan={plan}
        sessionId={sessionId}
        setup={setup}
        catalogState={{ catalogError, refreshCatalog, sendAvailable: onSend !== undefined }}
        workspace={workspace}
        tickets={state.tickets}
        onContextPickerOpenChange={setContextPickerOpen}
      />
    </form>
  )
}
