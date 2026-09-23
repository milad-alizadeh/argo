import type { LexicalEditor } from 'lexical'
import type { DragEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import { SessionContextBar } from '../context-bar/session-context-bar'
import type { ComposerAttachment, ComposerTicketContext } from '../hooks/use-composer-store'
import { DraftContextPicker } from '../references/context-picker/draft-context-picker'
import { ComposerToolbar } from '../toolbar/composer-toolbar'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { ComposerEditorArea } from './composer-editor-area'

type ComposerCardProps = {
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  contextPickerOpen: boolean
  contextTokens: number | null | undefined
  contextWindowTokens: number | null | undefined
  disabled?: boolean
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  harness: HarnessControl | null
  interruptRef: RefObject<HTMLButtonElement | null>
  isCompacting: boolean
  isHandingOff?: boolean
  isRunning: boolean
  onAttach: () => void
  onAddTicket: (ticket: Omit<ComposerTicketContext, 'id'>) => void
  onContextPickerOpenChange: (open: boolean) => void
  onChange: (text: string) => void
  onCompact?: () => Promise<boolean>
  onDropFiles: (files: FileList) => void
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  onRemoveAttachment: (id: string) => void
  onSend: () => void
  plan: SessionPlan | null
  sessionId: string
  setup: TurnSetupControlProps | null
  catalogState?: { catalogError: boolean; refreshCatalog?: () => void }
  workspace: WorkspaceMenuControlProps | null
}

function closeContextPicker(
  editorRef: RefObject<LexicalEditor | null>,
  onOpenChange: (open: boolean) => void,
) {
  onOpenChange(false)
  editorRef.current?.focus()
}

function dropFiles(event: DragEvent<HTMLFieldSetElement>, onDropFiles: (files: FileList) => void) {
  event.preventDefault()
  if (event.dataTransfer.files.length > 0) onDropFiles(event.dataTransfer.files)
}

function CardToolbar(
  props: Pick<
    ComposerCardProps,
    | 'attachments'
    | 'disabled'
    | 'draft'
    | 'harness'
    | 'interruptRef'
    | 'isRunning'
    | 'onContextPickerOpenChange'
    | 'onInterrupt'
    | 'setup'
    | 'workspace'
    | 'catalogState'
  >,
) {
  return (
    <ComposerToolbar
      attachments={props.attachments}
      disabled={props.disabled}
      draft={props.draft}
      harness={props.harness}
      interruptRef={props.interruptRef}
      isRunning={props.isRunning}
      onOpenContextPicker={() => props.onContextPickerOpenChange(true)}
      onInterrupt={props.onInterrupt}
      setup={props.setup}
      workspace={props.workspace}
      catalogError={props.catalogState?.catalogError}
      refreshCatalog={props.catalogState?.refreshCatalog}
    />
  )
}

function ComposerContextBar(
  props: Pick<
    ComposerCardProps,
    | 'contextTokens'
    | 'contextWindowTokens'
    | 'harness'
    | 'isCompacting'
    | 'isHandingOff'
    | 'onCompact'
    | 'onHandoff'
  >,
) {
  return (
    <div className="absolute inset-x-(--spacing-shell-gutter) top-full z-0 -mt-2">
      <SessionContextBar
        contextTokens={props.contextTokens}
        contextWindowTokens={props.contextWindowTokens}
        harness={props.harness?.harness}
        isCompacting={props.isCompacting}
        isHandingOff={props.isHandingOff}
        onCompact={props.onCompact}
        onHandoff={props.onHandoff}
      />
    </div>
  )
}

function ComposerContextPicker(
  props: Pick<
    ComposerCardProps,
    | 'contextPickerOpen'
    | 'draft'
    | 'onAddTicket'
    | 'onAttach'
    | 'onContextPickerOpenChange'
    | 'editorRef'
  >,
) {
  if (!props.contextPickerOpen) return null
  return (
    <DraftContextPicker
      draft={props.draft}
      onAddTicket={props.onAddTicket}
      onAttach={props.onAttach}
      onClose={() => closeContextPicker(props.editorRef, props.onContextPickerOpenChange)}
      editorRef={props.editorRef}
    />
  )
}

// The card and the context bar pinned under it: everything below the pending-turns list.
export function ComposerCard({
  attachments,
  tickets,
  contextPickerOpen,
  contextTokens,
  contextWindowTokens,
  disabled,
  draft,
  editorRef,
  focusOnMount,
  harness,
  interruptRef,
  isCompacting,
  isHandingOff,
  isRunning,
  onAttach,
  onAddTicket,
  onContextPickerOpenChange,
  onChange,
  onCompact,
  onDropFiles,
  onHandoff,
  onInterrupt,
  onRemoveAttachment,
  onSend,
  plan,
  sessionId,
  setup,
  workspace,
  catalogState,
}: ComposerCardProps) {
  const { t } = useTranslation('sessions')
  return (
    <div className="relative">
      {/* The editor takes the focus but the card wears the ring, so the ring follows the card's
          radius instead of boxing the bare text area (#2273). */}
      <fieldset
        aria-label={t('composer.cardLabel')}
        data-component="ComposerCard"
        className={`@container relative z-10 flex min-w-0 flex-col overflow-visible rounded-xl border border-border bg-card shadow-(--shadow-surface) has-[[data-keyboard-focus=true]]:ring-2 has-[[data-keyboard-focus=true]]:ring-ring${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}${disabled ? ' opacity-60' : ''}`}
        onDragOver={(event: DragEvent<HTMLFieldSetElement>) => event.preventDefault()}
        onDrop={(event) => dropFiles(event, onDropFiles)}
      >
        <ComposerEditorArea
          attachments={attachments}
          contextPickerOpen={contextPickerOpen}
          tickets={tickets}
          harness={harness?.harness ?? null}
          draft={draft}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onChange={onChange}
          onRemoveAttachment={onRemoveAttachment}
          onSend={onSend}
          plan={plan}
          sessionId={sessionId}
        />
        <CardToolbar
          {...{
            attachments,
            disabled,
            draft,
            harness,
            interruptRef,
            isRunning,
            onContextPickerOpenChange,
            onInterrupt,
            setup,
            workspace,
            catalogState,
          }}
        />
      </fieldset>
      <ComposerContextPicker
        {...{
          contextPickerOpen,
          draft,
          onAddTicket,
          onAttach,
          onContextPickerOpenChange,
          editorRef,
        }}
      />
      <ComposerContextBar
        contextTokens={contextTokens}
        contextWindowTokens={contextWindowTokens}
        harness={harness}
        isCompacting={isCompacting}
        isHandingOff={isHandingOff}
        onCompact={onCompact}
        onHandoff={onHandoff}
      />
    </div>
  )
}
