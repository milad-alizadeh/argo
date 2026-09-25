import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'
import type { SessionPlan } from '@/domains/sessions/renderer/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { ComposerEditor } from '../editor/session-composer-editor'
import { ComposerAttachments } from './composer-attachments'
import { SessionPlanPopover } from './session-plan-popover'

export function ComposerEditorArea({
  contextPickerOpen,
  harness,
  editorRef,
  focusOnMount,
  onSend,
  plan,
  sessionId,
}: {
  contextPickerOpen: boolean
  harness: SessionHarness | null
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onSend: () => void
  plan: SessionPlan | null
  sessionId: string
}) {
  return (
    <>
      <div className="absolute top-(--spacing-shell-inset) right-(--spacing-shell-inset) z-20">
        <SessionPlanPopover plan={plan} />
      </div>
      <ComposerAttachments sessionId={sessionId} />
      <div className="relative min-w-0 flex-1">
        <ComposerEditor
          key={sessionId}
          sessionId={sessionId}
          harness={harness}
          contextPickerOpen={contextPickerOpen}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onSend={onSend}
        />
      </div>
    </>
  )
}
