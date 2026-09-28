import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'
import type { SessionHarness } from '../../harness/harnesses'
import { ComposerEditor } from '../editor/session-composer-editor'
import { ComposerAttachments } from './composer-attachments'

export function ComposerEditorArea({
  contextPickerOpen,
  harness,
  editorRef,
  focusOnMount,
  onSend,
  sessionId,
}: {
  contextPickerOpen: boolean
  harness: SessionHarness | null
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onSend: () => void
  sessionId: string
}) {
  return (
    <>
      <ComposerAttachments />
      <div className="relative min-w-0 flex-1">
        <ComposerEditor
          key={sessionId}
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
