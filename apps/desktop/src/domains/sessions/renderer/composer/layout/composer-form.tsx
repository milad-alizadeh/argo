import { type ReactNode, useCallback } from 'react'
import type { ComposerCommandListing } from '@/domains/sessions/api/composer-commands'
import type { SessionPlan } from '@/domains/sessions/renderer/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import type { Send } from '../hooks/use-send'
import { useSessionComposerState } from '../hooks/use-session-composer-state'
import type { TicketChoice } from '../references/context-picker/context-picker-contents'
import { useComposerCommands } from '../references/use-composer-commands'
import type {
  CatalogFailure,
  TurnConfigurationControlProps,
} from '../toolbar/turn-configuration-menu'
import { WorkspaceMenu, type WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { AttachmentTray } from '../tray/attachment-tray'
import {
  supportedConfiguration,
  type TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'
import { ComposerCard } from './composer-card'
import '../editor/composer-content.css'
import type { ComposerEditing } from '../editing/composer-editing'
import { ComposerEditingProvider, useComposerEditing } from '../editing/composer-editing-context'

export const COMPOSER_COLUMN = 'mx-auto w-full max-w-(--size-session-column)'

export type ComposerFormProps = {
  contextTokens?: number | null
  contextWindowTokens?: number | null
  disabled?: boolean
  // Inert until the owner's draft loads, yet drawn like an enabled card; the draft then fills in.
  loading?: boolean
  focusOnMount?: boolean
  onFocusAfterMount?: () => void
  isCompacting?: boolean
  isHandingOff?: boolean
  isRunning?: boolean
  onCompact?: () => Promise<boolean>
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend?: Send
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
  commands?: ComposerCommandListing
  tickets?: readonly TicketChoice[]
  projectId?: string | null
  commandCwd?: string | null
  liveSessionId?: string | null
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
  // A Harness switch keeps the last Harness's values; send and draw only what these choices offer.
  const value = supportedConfiguration(choices, editing.turnConfiguration, choices.opening)
  return { choices, value, onChange }
}

function useComposerListing(input: {
  commands: ComposerCommandListing | undefined
  projectId: string | null | undefined
  liveSessionId: string | null | undefined
  harness: HarnessControl | null
  commandCwd: string | null
}) {
  const remoteCommands = useComposerCommands({
    enabled:
      input.commands === undefined &&
      (input.projectId !== undefined || input.liveSessionId !== undefined),
    harness: input.harness?.harness ?? null,
    cwd: input.commandCwd,
    sessionId: input.liveSessionId ?? null,
  })
  return input.commands ?? remoteCommands
}

function useEditingTurnConfiguration(
  supplied: TurnConfigurationControlProps | null,
  choices: TurnConfigurationChoices | null | undefined,
) {
  const { editing, dispatch } = useComposerEditing()
  const changeTurnConfiguration = useCallback(
    (turnConfiguration: NonNullable<ComposerEditing['turnConfiguration']>) =>
      dispatch({ type: 'turn-configuration.changed', turnConfiguration }),
    [dispatch],
  )
  return editingTurnConfiguration({
    supplied,
    choices,
    editing,
    onChange: changeTurnConfiguration,
  })
}

function ComposerFormSurface({
  contextTokens,
  contextWindowTokens,
  disabled = false,
  loading = false,
  focusOnMount = false,
  onFocusAfterMount,
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
  turnConfiguration: suppliedTurnConfiguration = null,
  turnConfigurationChoices,
  catalogFailure = null,
  refreshCatalog,
  workspace = null,
  commands,
  tickets,
  projectId,
  commandCwd = null,
  liveSessionId,
}: Omit<ComposerFormProps, 'initialEditing' | 'onEditingChange'>) {
  const turnConfiguration = useEditingTurnConfiguration(
    suppliedTurnConfiguration,
    turnConfigurationChoices,
  )
  const state = useSessionComposerState({ onSend, turnConfiguration })
  const listing = useComposerListing({
    commands,
    projectId,
    liveSessionId,
    harness,
    commandCwd,
  })
  const send = () => {
    if (!disabled && !loading && onSend) void state.send()
  }
  return (
    <form
      inert={loading}
      className={`${COMPOSER_COLUMN} @container flex h-full min-h-0 flex-col pt-(--spacing-shell-section) pb-(--spacing-session-composer-bottom)`}
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <AttachmentTray>{permissionPrompt}</AttachmentTray>
      {workspace ? (
        <div className="mb-2 px-1">
          <WorkspaceMenu {...workspace} />
        </div>
      ) : null}
      <ComposerCard
        contextTokens={contextTokens}
        contextWindowTokens={contextWindowTokens}
        disabled={disabled}
        editorRef={state.editorRef}
        focusOnMount={focusOnMount && !loading}
        onFocusAfterMount={onFocusAfterMount}
        harness={harness}
        isCompacting={isCompacting}
        isHandingOff={isHandingOff}
        isRunning={isRunning}
        onCompact={onCompact}
        onHandoff={onHandoff}
        onInterrupt={onInterrupt}
        onSend={send}
        commands={listing}
        plan={plan}
        projectId={projectId}
        sessionId={sessionId}
        tickets={tickets}
        turnConfiguration={turnConfiguration}
        catalogState={{ catalogFailure, refreshCatalog, sendAvailable: onSend !== undefined }}
      />
    </form>
  )
}

export function ComposerForm({ initialEditing, onEditingChange, ...props }: ComposerFormProps) {
  return (
    // The loaded draft starts a fresh edit, so nothing edited while loading outlives it.
    <ComposerEditingProvider
      initial={initialEditing}
      onChange={onEditingChange}
      owner={props.loading === true ? `${props.sessionId}:loading` : props.sessionId}
    >
      <ComposerFormSurface {...props} />
    </ComposerEditingProvider>
  )
}
