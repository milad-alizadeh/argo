import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import { InputGroup } from '../../../components/ui/input-group'
import { ComposerEditor } from './SessionComposerEditor'
import { SessionPlanPopover } from './SessionPlanPopover'

export type SessionComposerProps = {
  isRunning?: boolean
  onInterrupt?: () => Promise<boolean>
  plan: SessionPlan | null
  sessionId: string
  onSend: (text: string) => Promise<boolean>
}
export function SessionComposer({
  isRunning = false,
  onInterrupt,
  plan,
  sessionId,
  onSend,
}: SessionComposerProps) {
  const [drafts, setDrafts] = useState(() => new Map<string, string>())
  const draft = drafts.get(sessionId) ?? ''
  // The editor owns its text and reports it up. Writing the draft back on every change raced a
  // keystroke typed before the re-render, dropping it and moving the caret to the start.
  const editorRef = useRef<LexicalEditor>(null)

  const changeDraft = useCallback(
    (text: string) => {
      setDrafts((current) => new Map(current).set(sessionId, text))
    },
    [sessionId],
  )

  const send = useCallback(async () => {
    if (!draft.trim()) return
    // Taken before the await: a Session switch mid-send remounts the editor under the ref.
    const editor = editorRef.current
    if (!(await onSend(draft))) return
    editor?.update(() => {
      $getRoot().clear().append($createParagraphNode())
    })
    setDrafts((current) => new Map(current).set(sessionId, ''))
  }, [draft, onSend, sessionId])

  const interrupt = useCallback(async () => {
    if (onInterrupt) await onInterrupt()
  }, [onInterrupt])

  return (
    <form
      className="mx-auto w-full max-w-(--size-session-column) px-(--spacing-shell-gutter) pt-(--spacing-shell-section) pb-(--spacing-shell-region)"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <InputGroup
        className={`relative flex !h-auto min-w-0 !items-stretch overflow-hidden !rounded-xl !border-border !bg-card shadow-xl shadow-foreground/10${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}`}
      >
        <div className="absolute top-(--spacing-shell-inset) right-(--spacing-shell-inset) z-20">
          <SessionPlanPopover plan={plan} />
        </div>
        <div className="flex min-w-0 flex-1 self-stretch flex-col">
          <ComposerEditor
            key={sessionId}
            draft={draft}
            editorRef={editorRef}
            onChange={changeDraft}
            onSend={() => void send()}
          />
        </div>
        <div className="flex items-end p-(--spacing-shell-item)">
          {isRunning ? (
            <Button
              aria-label="Interrupt"
              className="type-composer-control"
              onClick={() => void interrupt()}
              type="button"
            >
              Interrupt
            </Button>
          ) : (
            <Button
              aria-label="Send message"
              className="rounded-full"
              disabled={!draft.trim()}
              size="icon"
              type="submit"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </InputGroup>
    </form>
  )
}
