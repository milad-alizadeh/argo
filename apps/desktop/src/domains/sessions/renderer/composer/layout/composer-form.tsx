import type { ReactNode } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import type { Send } from '../hooks/use-send'
import { useSessionComposerState } from '../hooks/use-session-composer-state'
import type { CatalogFailure, TurnSetupControlProps } from '../toolbar/run-setup-menu'
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
  catalogFailure?: CatalogFailure | null
  refreshCatalog?: () => void
  workspace?: WorkspaceMenuControlProps | null
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
  catalogFailure = null,
  refreshCatalog,
  workspace = null,
}: ComposerFormProps) {
  const state = useSessionComposerState({ sessionId, isRunning, onSend, setup })
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
          editorRef={state.editorRef}
          onSteer={onSteer}
          sessionId={sessionId}
          setup={setup}
        />
      </AttachmentTray>
      <ComposerCard
        contextTokens={contextTokens}
        contextWindowTokens={contextWindowTokens}
        disabled={disabled}
        editorRef={state.editorRef}
        focusOnMount={focusOnMount}
        harness={harness}
        isCompacting={isCompacting}
        isHandingOff={isHandingOff}
        isRunning={isRunning}
        onCompact={onCompact}
        onHandoff={onHandoff}
        onInterrupt={onInterrupt}
        onSend={send}
        plan={plan}
        sessionId={sessionId}
        setup={setup}
        catalogState={{ catalogFailure, refreshCatalog, sendAvailable: onSend !== undefined }}
        workspace={workspace}
      />
    </form>
  )
}
