import type { HarnessControl } from '../../harness'
import { type ReactNode, useEffect, useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model'
import { activeReference } from '../references/composer-reference-menu'
import { useComposer } from '../composer'
import type { Send } from '../hooks'
import { ComposerForm } from '../layout'
import type { TurnSetupControlProps, WorkspaceMenuControlProps } from '../toolbar'
import './composer-content.css'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive'

export type SessionComposerProps = {
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
  onSend: Send
  onSteer?: (text: string, attachments: SessionAttachmentInput[]) => Promise<boolean>
  permissionPrompt?: ReactNode
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
  workspace?: WorkspaceMenuControlProps | null
}

export function SessionComposer({
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
  workspace = null,
}: SessionComposerProps) {
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const state = useComposer({ identity: sessionId, isRunning, send: onSend, steer: onSteer, setup })
  useEffect(() => {
    if (activeReference(state.draft)?.trigger === '@') setContextPickerOpen(true)
  }, [state.draft])
  return (
    <ComposerForm
      attachments={state.attachments}
      contextPickerOpen={contextPickerOpen}
      contextTokens={contextTokens}
      contextWindowTokens={contextWindowTokens}
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
      onSteer={state.steerPendingTurn}
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
      workspace={workspace}
      tickets={state.tickets}
      onContextPickerOpenChange={setContextPickerOpen}
    />
  )
}
