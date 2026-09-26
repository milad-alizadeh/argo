import type { LexicalEditor } from 'lexical'
import { type DragEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionPlan } from '@/domains/sessions/renderer/model/models'
import type { HarnessControl } from '../../harness/harnesses'
import { SessionContextBar } from '../context-bar/session-context-bar'
import { useComposerEditing } from '../editing/composer-editing-context'
import { useAttachmentTransfer } from '../hooks/use-composer-attachments'
import { activeReference } from '../references/composer-reference-menu'
import { DraftContextPicker } from '../references/context-picker/draft-context-picker'
import { ComposerToolbar } from '../toolbar/composer-toolbar'
import type { TurnConfigurationControlProps } from '../toolbar/turn-configuration-menu'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { ComposerEditorArea } from './composer-editor-area'

type ComposerCardProps = {
  contextTokens: number | null | undefined
  contextWindowTokens: number | null | undefined
  disabled?: boolean
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  harness: HarnessControl | null
  isCompacting: boolean
  isHandingOff?: boolean
  isRunning: boolean
  onCompact?: () => Promise<boolean>
  onHandoff?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  onSend: () => void
  plan: SessionPlan | null
  sessionId: string
  turnConfiguration: TurnConfigurationControlProps | null
  catalogState?: {
    catalogFailure: import('../toolbar/turn-configuration-menu').CatalogFailure | null
    refreshCatalog?: () => void
    sendAvailable?: boolean
  }
  workspace: WorkspaceMenuControlProps | null
}

function useFocusInterruptOnCompactStart(isCompacting: boolean) {
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)
  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])
  return interruptRef
}

function useContextPicker(draft: string) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (activeReference(draft)?.trigger === '@') setOpen(true)
  }, [draft])
  return [open, setOpen] as const
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

function ComposerContextPicker({
  editorRef,
  open,
  setOpen,
}: {
  editorRef: RefObject<LexicalEditor | null>
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { editing, dispatch } = useComposerEditing()
  const { attachFiles } = useAttachmentTransfer((paths) =>
    dispatch({ type: 'attachments.added', paths, createId: crypto.randomUUID }),
  )
  if (!open) return null
  return (
    <DraftContextPicker
      draft={editing.prompt}
      onAddTicket={(ticket) =>
        dispatch({ type: 'ticket.added', ticket, createId: crypto.randomUUID })
      }
      onAttach={() => void attachFiles()}
      onClose={() => closeContextPicker(editorRef, setOpen)}
      editorRef={editorRef}
    />
  )
}

// The card and the context bar pinned under it: everything below the pending-turns list.
export function ComposerCard(props: ComposerCardProps) {
  const { t } = useTranslation('sessions')
  const { editing, dispatch } = useComposerEditing()
  const { dropFiles: dropAttachedFiles } = useAttachmentTransfer((paths) =>
    dispatch({ type: 'attachments.added', paths, createId: crypto.randomUUID }),
  )
  const [contextPickerOpen, setContextPickerOpen] = useContextPicker(editing.prompt)
  const interruptRef = useFocusInterruptOnCompactStart(props.isCompacting)
  return (
    <div className="relative shrink-0">
      {/* The editor takes the focus but the card wears the ring, so the ring follows the card's
          radius instead of boxing the bare text area (#2273). */}
      <fieldset
        aria-label={t('composer.cardLabel')}
        data-component="ComposerCard"
        className={`@container relative z-10 flex min-w-0 flex-col overflow-visible rounded-xl border border-border bg-card shadow-(--shadow-surface) has-[[data-keyboard-focus=true]]:ring-2 has-[[data-keyboard-focus=true]]:ring-ring${props.plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}${props.disabled ? ' opacity-60' : ''}`}
        onDragOver={(event: DragEvent<HTMLFieldSetElement>) => event.preventDefault()}
        onDrop={(event) => dropFiles(event, dropAttachedFiles)}
      >
        <ComposerEditorArea
          contextPickerOpen={contextPickerOpen}
          harness={props.harness?.harness ?? null}
          editorRef={props.editorRef}
          focusOnMount={props.focusOnMount}
          onSend={props.onSend}
          plan={props.plan}
          sessionId={props.sessionId}
        />
        <ComposerToolbar
          disabled={props.disabled}
          sendAvailable={props.catalogState?.sendAvailable}
          harness={props.harness}
          interruptRef={interruptRef}
          isRunning={props.isRunning}
          onOpenContextPicker={() => setContextPickerOpen(true)}
          onInterrupt={props.onInterrupt}
          turnConfiguration={props.turnConfiguration}
          workspace={props.workspace}
          catalogFailure={props.catalogState?.catalogFailure}
          refreshCatalog={props.catalogState?.refreshCatalog}
        />
      </fieldset>
      <ComposerContextPicker
        editorRef={props.editorRef}
        open={contextPickerOpen}
        setOpen={setContextPickerOpen}
      />
      <ComposerContextBar {...props} />
    </div>
  )
}
