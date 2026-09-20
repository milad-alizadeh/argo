import { type ReactNode, useEffect, useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import { useComposer } from '@/domains/sessions/renderer/composer/composer'
import { ComposerForm } from '@/domains/sessions/renderer/composer/composer-form'
import { activeReference } from '@/domains/sessions/renderer/composer/references/composer-reference-menu'
import type { HarnessControl } from '@/domains/sessions/renderer/harness/harnesses'
import './composer-content.css'
import type { TurnSetupControlProps } from '@/domains/sessions/renderer/composer/run-setup-menu'
import type { Send } from '@/domains/sessions/renderer/composer/use-send'

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
  permissionPrompt?: ReactNode
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
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
  permissionPrompt,
  plan = null,
  harness = null,
  setup = null,
}: SessionComposerProps) {
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const state = useComposer({ identity: sessionId, isRunning, send: onSend, setup })
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
      onContextPickerOpenChange={setContextPickerOpen}
    />
  )
}
