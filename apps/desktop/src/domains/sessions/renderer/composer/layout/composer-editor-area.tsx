import type { LexicalEditor } from 'lexical'
import type { RefObject } from 'react'
import type { SessionHarness } from '../../harness/harnesses'
import { ComposerEditor } from '../editor/session-composer-editor'
import { ComposerAttachments } from './composer-attachments'

export function ComposerEditorArea({
  contextPickerOpen,
  disabled,
  harness,
  editorRef,
  focusOnMount,
  onFocusAfterMount,
  onSend,
  sessionId,
}: {
  contextPickerOpen: boolean
  disabled: boolean
  harness: SessionHarness | null
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onFocusAfterMount?: () => void
  onSend: () => void
  sessionId: string
}) {
  return (
    <>
      <ComposerAttachments />
      <div className="relative min-w-0 flex-1">
        {/* One Lexical editor per owner, so an in-flight Send cannot clear the next owner's text. */}
        <ComposerEditor
          key={sessionId}
          harness={harness}
          contextPickerOpen={contextPickerOpen}
          disabled={disabled}
          editorRef={editorRef}
          focusOnMount={focusOnMount}
          onFocusAfterMount={onFocusAfterMount}
          onSend={onSend}
        />
      </div>
    </>
  )
}
