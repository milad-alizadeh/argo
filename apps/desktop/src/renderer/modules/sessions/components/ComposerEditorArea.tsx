import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { SessionCli } from '../harness/harnesses'
import type { ComposerAttachment, ComposerTicketContext } from '../state/useComposerStore'
import { ComposerAttachments } from './ComposerAttachments'
import { ComposerTicketContexts } from './ComposerTicketContexts'
import { ComposerEditor } from './SessionComposerEditor'
import { SessionPlanPopover } from './SessionPlanPopover'

export function ComposerEditorArea({
  attachments,
  tickets,
  cli,
  draft,
  editorRef,
  focusOnMount,
  onChange,
  onOpenTicket,
  onRemoveAttachment,
  onRemoveTicket,
  onSend,
  plan,
  sessionId,
}: {
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  cli: SessionCli | null
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onChange: (text: string) => void
  onOpenTicket?: (key: string) => void
  onRemoveAttachment: (id: string) => void
  onRemoveTicket: (id: string) => void
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
      <ComposerTicketContexts
        onOpenTicket={onOpenTicket}
        onRemove={onRemoveTicket}
        tickets={tickets}
      />
      <div className="min-w-0 flex-1">
        <ComposerEditor
          key={sessionId}
          cli={cli}
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
