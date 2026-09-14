import type { LexicalEditor } from 'lexical'
import type { DragEvent, RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { HarnessControl } from '../harness/harnesses'
import type { ComposerAttachment } from '../state/useComposerStore'
import { ComposerEditorArea } from './ComposerEditorArea'
import { ComposerToolbar } from './ComposerToolbar'
import type { TurnSetupControlProps } from './RunSetupMenu'
import { SessionContextBar } from './SessionContextBar'

type ComposerCardProps = {
  attachments: ComposerAttachment[]
  contextTokens: number | null | undefined
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
}

// The card and the context bar pinned under it: everything below the pending-turns list.
export function ComposerCard({
  attachments,
  contextTokens,
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
}: ComposerCardProps) {
  return (
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
          isHandingOff={isHandingOff}
          onCompact={onCompact}
          onHandoff={onHandoff}
        />
      </div>
    </div>
  )
}
