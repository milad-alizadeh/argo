import { type ReactNode, useCallback } from 'react'
import type { SessionPlan } from '@/domains/sessions/renderer/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import type { Send } from '../hooks/use-send'
import { useSessionComposerState } from '../hooks/use-session-composer-state'
import type {
  CatalogFailure,
  TurnConfigurationControlProps,
} from '../toolbar/turn-configuration-menu'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { AttachmentTray } from '../tray/attachment-tray'
import { PendingTurns } from '../tray/pending-turns'
import type { TurnConfigurationChoices } from '../turn-configuration/turn-configuration'
import { ComposerCard } from './composer-card'
import '../editor/composer-content.css'
import type { SessionAttachmentInput } from '@/domains/sessions/api/attachments'
import type { ComposerEditing } from '../editing/composer-editing'
import { ComposerEditingProvider, useComposerEditing } from '../editing/composer-editing-context'

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
  turnConfiguration?: TurnConfigurationControlProps | null
  turnConfigurationChoices?: TurnConfigurationChoices | null
  catalogFailure?: CatalogFailure | null
  refreshCatalog?: () => void
  workspace?: WorkspaceMenuControlProps | null
  initialEditing?: Partial<ComposerEditing>
  onEditingChange?: (editing: ComposerEditing) => void
}

function editingTurnConfiguration(input: {
  supplied: TurnConfigurationControlProps | null
  choices: TurnConfigurationChoices | null | undefined
  editing: ComposerEditing
  onChange: TurnConfigurationControlProps['onChange']
}) {
  const { supplied, choices, editing, onChange } = input
  if (choices === undefined) return supplied
  if (choices === null || editing.turnConfiguration === null) return null
  return { choices, value: editing.turnConfiguration, onChange }
}

function ComposerFormSurface({
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
  turnConfiguration: suppliedTurnConfiguration = null,
  turnConfigurationChoices,
  catalogFailure = null,
  refreshCatalog,
  workspace = null,
}: Omit<ComposerFormProps, 'initialEditing' | 'onEditingChange'>) {
  const { editing, dispatch } = useComposerEditing()
  const changeTurnConfiguration = useCallback(
    (turnConfiguration: NonNullable<ComposerEditing['turnConfiguration']>) =>
      dispatch({ type: 'turn-configuration.changed', turnConfiguration }),
    [dispatch],
  )
  const turnConfiguration = editingTurnConfiguration({
    supplied: suppliedTurnConfiguration,
    choices: turnConfigurationChoices,
    editing,
    onChange: changeTurnConfiguration,
  })
  const state = useSessionComposerState({ isRunning, onSend, turnConfiguration })
  const send = () => {
    if (!disabled && onSend) void state.send()
  }
  return (
    <form
      className={`${COMPOSER_COLUMN} @container flex h-full min-h-0 flex-col pt-(--spacing-shell-section) pb-(--spacing-session-composer-bottom)`}
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
          turnConfiguration={turnConfiguration}
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
        turnConfiguration={turnConfiguration}
        catalogState={{ catalogFailure, refreshCatalog, sendAvailable: onSend !== undefined }}
        workspace={workspace}
      />
    </form>
  )
}

export function ComposerForm({ initialEditing, onEditingChange, ...props }: ComposerFormProps) {
  return (
    <ComposerEditingProvider
      initial={initialEditing}
      key={props.sessionId}
      onChange={onEditingChange}
    >
      <ComposerFormSurface {...props} />
    </ComposerEditingProvider>
  )
}
