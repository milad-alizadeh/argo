import { useState } from 'react'
import type { SessionPlan } from '@/core/sessions/models'
import type { HarnessControl } from '../harness/harnesses'
import { ComposerForm } from './ComposerForm'
import './composer-content.css'
import type { TurnSetupControlProps } from './RunSetupMenu'
import type { Send } from './useSend'
import { useSessionComposerState } from './useSessionComposerState'

export type SessionComposerProps = {
  contextTokens?: number | null
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
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
}

export function SessionComposer({
  contextTokens,
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
  plan = null,
  harness = null,
  setup = null,
}: SessionComposerProps) {
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const state = useSessionComposerState({ isRunning, onSend, sessionId, setup })
  return (
    <ComposerForm
      attachments={state.attachments}
      contextPickerOpen={contextPickerOpen}
      contextTokens={contextTokens}
      disabled={disabled}
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
      onRemoveTicket={state.removeTicket}
      onReorder={state.reorderPendingTurn}
      onSend={() => {
        if (!disabled) void state.send()
      }}
      pendingTurns={state.pendingTurns}
      plan={plan}
      sessionId={sessionId}
      setup={setup}
      tickets={state.tickets}
      onContextPickerOpenChange={setContextPickerOpen}
    />
  )
}
