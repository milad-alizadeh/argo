import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { ComposerEditor } from '../editor/session-composer-editor'
import type { ComposerAttachment, ComposerTicketContext } from '../hooks/use-composer-store'
import { ComposerAttachments } from './composer-attachments'
import { SessionPlanPopover } from './session-plan-popover'

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
