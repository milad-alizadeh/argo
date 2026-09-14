import type { LexicalEditor } from 'lexical'
import { type DragEvent, type RefObject, useEffect, useRef } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { HarnessControl } from '../harness/harnesses'
import type { ComposerAttachment } from '../state/useComposerStore'
import { ComposerEditorArea } from './ComposerEditorArea'
import { ComposerToolbar } from './ComposerToolbar'
import { PendingTurns } from './PendingTurns'
import type { TurnSetupControlProps } from './RunSetupMenu'
import { SessionContextBar } from './SessionContextBar'
import type { usePendingTurns } from './usePendingTurns'

// The composer card's column; attached secondary surfaces inset from its edges.
export const COMPOSER_COLUMN = 'mx-auto w-full max-w-(--size-session-column)'

// Compacting steals focus onto Interrupt the moment it starts, so a keyboard user lands on the
// one control that matters without having to tab there.
function useFocusInterruptOnCompactStart(isCompacting: boolean) {
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)
  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])
  return interruptRef
}

export function ComposerForm({
  attachments,
  disabled = false,
  draft,
  editorRef,
  focusOnMount,
  contextTokens,
  isCompacting,
  onAttach,
  onCompact,
  isRunning,
  onChange,
  onDropFiles,
  onEdit,
  onInterrupt,
  onRemove,
  onRemoveAttachment,
  onReorder,
  onSend,
  pendingTurns,
  plan,
  sessionId,
  harness,
  setup,
}: {
  attachments: ComposerAttachment[]
  disabled?: boolean
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  contextTokens: number | null | undefined
  isCompacting: boolean
  onAttach: () => void
  onCompact?: () => Promise<boolean>
  isRunning: boolean
  onChange: (text: string) => void
  onDropFiles: (files: FileList) => void
  onEdit: (turn: (typeof pendingTurns)[number]) => void
  onInterrupt?: () => Promise<boolean>
  onRemove: (id: string) => void
  onRemoveAttachment: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
  onSend: () => void
  pendingTurns: ReturnType<typeof usePendingTurns>['pendingTurns']
  plan: SessionPlan | null
  sessionId: string
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
}) {
  const interruptRef = useFocusInterruptOnCompactStart(isCompacting)
  return (
    <form
      className={`${COMPOSER_COLUMN} @container pt-(--spacing-shell-section) pb-(--spacing-session-composer-bottom)`}
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <PendingTurns
        turns={pendingTurns}
        onEdit={onEdit}
        onRemove={onRemove}
        onReorder={onReorder}
      />
      <div className="relative">
        <fieldset
          aria-label="Message composer"
          data-component="ComposerCard"
          className={`@container relative z-10 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-surface)${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}${disabled ? ' opacity-60' : ''}`}
          onDragOver={(event: DragEvent<HTMLFieldSetElement>) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLFieldSetElement>) => {
            event.preventDefault()
            if (event.dataTransfer.files.length > 0) onDropFiles(event.dataTransfer.files)
          }}
        >
          <ComposerEditorArea
            attachments={attachments}
            cli={harness?.cli ?? null}
            draft={draft}
            editorRef={editorRef}
            focusOnMount={focusOnMount}
            onChange={onChange}
            onRemoveAttachment={onRemoveAttachment}
            onSend={onSend}
            plan={plan}
            sessionId={sessionId}
          />
          <ComposerToolbar
            attachments={attachments}
            disabled={disabled}
            draft={draft}
            editorRef={editorRef}
            harness={harness}
            interruptRef={interruptRef}
            isRunning={isRunning}
            onAttach={onAttach}
            onInterrupt={onInterrupt}
            setup={setup}
          />
        </fieldset>
        <div className="absolute inset-x-(--spacing-shell-gutter) top-full z-0 -mt-2">
          <SessionContextBar
            contextTokens={contextTokens}
            harness={harness?.cli}
            isCompacting={isCompacting}
            onCompact={onCompact}
          />
        </div>
      </div>
    </form>
  )
}
