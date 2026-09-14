import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { ComposerAttachment } from '../state/useComposerStore'
import { ComposerAttachments } from './ComposerAttachments'
import { ComposerEditor } from './SessionComposerEditor'
import { SessionPlanPopover } from './SessionPlanPopover'

export function ComposerEditorArea({
  attachments,
  draft,
  editorRef,
  focusOnMount,
  onChange,
  onRemoveAttachment,
  onSend,
  plan,
  sessionId,
}: {
  attachments: ComposerAttachment[]
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onChange: (text: string) => void
  onRemoveAttachment: (id: string) => void
  onSend: () => void
  plan: SessionPlan | null
  sessionId: string
}) {
  return (
    <>
      <div className="absolute top-(--spacing-shell-inset) right-(--spacing-shell-inset) z-20">
        <SessionPlanPopover plan={plan} />
      </div>
      <ComposerAttachments attachments={attachments} onRemove={onRemoveAttachment} />
      <div className="relative min-w-0 flex-1">
        <ComposerEditor
          key={sessionId}
          draft={draft}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onChange={onChange}
          onSend={onSend}
        />
      </div>
    </>
  )
}
