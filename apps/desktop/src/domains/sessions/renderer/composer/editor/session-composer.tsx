import { type ReactNode, useEffect, useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import { useComposer } from '../hooks/use-composer'
import type { Send } from '../hooks/use-send'
import { ComposerForm } from '../layout/composer-form'
import { activeReference } from '../references/composer-reference-menu'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import './composer-content.css'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'

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
  catalogError = false,
  refreshCatalog,
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
        if (!disabled && onSend) void state.send()
      }}
      sendAvailable={onSend !== undefined}
      pendingTurns={state.pendingTurns}
      permissionPrompt={permissionPrompt}
      plan={plan}
      sessionId={sessionId}
      setup={setup}
      catalogError={catalogError}
      refreshCatalog={refreshCatalog}
      workspace={workspace}
      tickets={state.tickets}
      onContextPickerOpenChange={setContextPickerOpen}
    />
  )
}
