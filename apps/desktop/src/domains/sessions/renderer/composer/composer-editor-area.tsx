import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'

import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { ComposerAttachments } from './composer-attachments'
import { ComposerEditor } from './session-composer-editor'
import { SessionPlanPopover } from './session-plan-popover'
import type { ComposerAttachment, ComposerTicketContext } from './use-composer-store'

export function ComposerEditorArea({
  attachments,
  contextPickerOpen,
  tickets,
  harness,
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
  contextPickerOpen: boolean
  tickets: ComposerTicketContext[]
  harness: SessionHarness | null
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
          harness={harness}
          contextPickerOpen={contextPickerOpen}
          draft={draft}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onChange={onChange}
          onSend={onSend}
          tickets={tickets}
        />
      </div>
    </>
  )
}
