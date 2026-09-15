import { type ReactNode, useEffect, useState } from 'react'
import type { SessionPlan, SessionTicket } from '@/core/sessions/models'
import type { DevelopmentIdentity } from '@/development/instance'
import type { HarnessControl } from '../../harness/harnesses'
import { ComposerForm } from './composer-form'
import { activeReference } from './references/composer-reference-menu'
import './composer-content.css'
import type { TurnSetupControlProps } from './run-setup-menu'
import type { Send } from './use-send'
import { useSessionComposerState } from './use-session-composer-state'

export type SessionComposerProps = {
  contextTokens?: number | null
  developmentIdentity?: DevelopmentIdentity | null
  disabled?: boolean
  focusOnMount?: boolean
  isCompacting?: boolean
  isHandingOff?: boolean
  isRunning?: boolean
  onCompact?: () => Promise<boolean>
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: Send
  permissionPrompt?: ReactNode
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
  ticket?: SessionTicket | null
}

export function SessionComposer({
  contextTokens,
  developmentIdentity = null,
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
  permissionPrompt,
  plan = null,
  harness = null,
  setup = null,
  ticket = null,
}: SessionComposerProps) {
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const state = useSessionComposerState({ isRunning, onSend, sessionId, setup })
  useEffect(() => {
    if (activeReference(state.draft)?.trigger === '@') setContextPickerOpen(true)
  }, [state.draft])
  return (
    <ComposerForm
      attachments={state.attachments}
      contextPickerOpen={contextPickerOpen}
      contextTokens={contextTokens}
      disabled={disabled}
      developmentIdentity={developmentIdentity}
      draft={state.draft}
      editorRef={state.editorRef}
      focusOnMount={focusOnMount}
      harness={harness}
      isCompacting={isCompacting}
      isHandingOff={isHandingOff}
      isRunning={isRunning}
      onAttach={() => void state.attachFiles()}
      onAddTicket={state.addTicket}
      onChange={state.changeDraft}
      onCompact={onCompact}
      onDropFiles={state.dropFiles}
      onEdit={state.onEdit}
      onHandoff={onHandoff}
      onInterrupt={onInterrupt}
      onRemove={state.removePendingTurn}
      onRemoveAttachment={state.removeAttachment}
      onReorder={state.reorderPendingTurn}
      onSend={() => {
        if (!disabled) void state.send()
      }}
      pendingTurns={state.pendingTurns}
      permissionPrompt={permissionPrompt}
      plan={plan}
      sessionId={sessionId}
      setup={setup}
      tickets={state.tickets}
      ticket={ticket}
      onContextPickerOpenChange={setContextPickerOpen}
    />
  )
}
