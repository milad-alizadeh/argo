import type { SessionPlan } from '@/core/sessions/models'
import type { HarnessControl } from '../harness/harnesses'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { ComposerForm } from './ComposerForm'
import './composer-content.css'
import type { TurnSetupControlProps } from './RunSetupMenu'
import { useSessionComposerState } from './useSessionComposerState'

export type SessionComposerProps = {
  contextTokens?: number | null
  disabled?: boolean
  focusOnMount?: boolean
  isCompacting?: boolean
  isRunning?: boolean
  onCompact?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: (text: string, setup: TurnSetup | null) => Promise<boolean>
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
}

export function SessionComposer({
  contextTokens,
  disabled = false,
  focusOnMount = false,
  isCompacting = false,
  isRunning = false,
  onCompact,
  onInterrupt,
  sessionId,
  onSend,
  plan = null,
  harness = null,
  setup = null,
}: SessionComposerProps) {
  const state = useSessionComposerState({ isRunning, onSend, sessionId, setup })
  return (
    <ComposerForm
      attachments={state.attachments}
      contextTokens={contextTokens}
      disabled={disabled}
      draft={state.draft}
      editorRef={state.editorRef}
      focusOnMount={focusOnMount}
      harness={harness}
      isCompacting={isCompacting}
      isRunning={isRunning}
      onAttach={() => void state.attachFiles()}
      onChange={state.changeDraft}
      onCompact={onCompact}
      onDropFiles={state.dropFiles}
      onEdit={state.onEdit}
      onInterrupt={onInterrupt}
      onRemove={state.removePendingTurn}
      onRemoveAttachment={state.removeAttachment}
      onReorder={state.reorderPendingTurn}
      onSend={() => {
        if (!disabled) void state.send()
      }}
      pendingTurns={state.pendingTurns}
      plan={plan}
      sessionId={sessionId}
      setup={setup}
    />
  )
}
