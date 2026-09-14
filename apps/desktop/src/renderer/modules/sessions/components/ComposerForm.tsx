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

// The column the composer card sits in; a message about the composer shares it, so it is never wider.
export const COMPOSER_COLUMN =
  'mx-auto w-full max-w-(--size-session-column) px-(--spacing-shell-gutter)'

export function ComposerForm({
  attachments,
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
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)
  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])
  return (
    <form
      className={`${COMPOSER_COLUMN} @container pt-(--spacing-shell-section) pb-(--spacing-shell-region)`}
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
          className={`@container relative z-10 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/10${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}`}
          onDragOver={(event: DragEvent<HTMLFieldSetElement>) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLFieldSetElement>) => {
            event.preventDefault()
            if (event.dataTransfer.files.length > 0) onDropFiles(event.dataTransfer.files)
          }}
        >
          <ComposerEditorArea
            attachments={attachments}
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
            draft={draft}
            harness={harness}
            interruptRef={interruptRef}
            isRunning={isRunning}
            onAttach={onAttach}
            onInterrupt={onInterrupt}
            setup={setup}
          />
        </fieldset>
        <div className="absolute inset-x-0 top-full z-0 -mt-2">
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
