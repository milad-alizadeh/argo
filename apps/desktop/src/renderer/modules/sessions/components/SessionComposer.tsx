import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { ArrowUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../../components/ui/button'

export type SessionComposerProps = {
  isRunning?: boolean
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: (text: string) => Promise<boolean>
}

function editorState(text: string) {
  return () => {
    const root = $getRoot()
    root.clear()
    root.append($createParagraphNode().append($createTextNode(text)))
  }
}

function ComposerEditor({
  draft,
  onChange,
  onSend,
}: {
  draft: string
  onChange: (text: string) => void
  onSend: () => void
}) {
  return (
    <LexicalComposer
      initialConfig={{
        editorState: editorState(draft),
        namespace: 'argo-session-composer',
        onError: (error) => {
          throw error
        },
      }}
    >
      <PlainTextPlugin
        ErrorBoundary={({ children }) => children}
        contentEditable={
          <ContentEditable
            aria-label="Message"
            aria-placeholder="Direct the next move…"
            className="min-h-20 flex-1 whitespace-pre-wrap px-4 py-3 text-sm leading-6 outline-none"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              onSend()
            }}
            placeholder={
              <span
                aria-hidden="true"
                className="pointer-events-none absolute px-4 py-3 text-sm text-muted-foreground"
              >
                Direct the next move…
              </span>
            }
          />
        }
        placeholder={
          <span
            aria-hidden="true"
            className="pointer-events-none absolute px-4 py-3 text-sm text-muted-foreground"
          >
            Direct the next move…
          </span>
        }
      />
      <OnChangePlugin
        onChange={(state) => {
          state.read(() => onChange($getRoot().getTextContent()))
        }}
      />
      <DraftSync draft={draft} />
    </LexicalComposer>
  )
}

function DraftSync({ draft }: { draft: string }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.update(() => {
      const root = $getRoot()
      if (root.getTextContent() === draft) return
      root.clear()
      root.append($createParagraphNode().append($createTextNode(draft)))
    })
  }, [draft, editor])
  return null
}

export function SessionComposer({
  isRunning = false,
  onInterrupt,
  sessionId,
  onSend,
}: SessionComposerProps) {
  const [drafts, setDrafts] = useState(() => new Map<string, string>())
  const draft = drafts.get(sessionId) ?? ''

  const changeDraft = useCallback(
    (text: string) => {
      setDrafts((current) => new Map(current).set(sessionId, text))
    },
    [sessionId],
  )

  const send = useCallback(async () => {
    if (!draft.trim()) return
    if (!(await onSend(draft))) return
    setDrafts((current) => new Map(current).set(sessionId, ''))
  }, [draft, onSend, sessionId])

  const interrupt = useCallback(async () => {
    if (onInterrupt) await onInterrupt()
  }, [onInterrupt])

  return (
    <form
      className="mx-auto w-full max-w-4xl px-(--spacing-shell-gutter) pt-6 pb-8"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <div className="relative flex overflow-hidden rounded-xl border bg-card shadow-lg shadow-foreground/10">
        <div className="min-w-0 flex-1">
          <ComposerEditor
            key={sessionId}
            draft={draft}
            onChange={changeDraft}
            onSend={() => void send()}
          />
        </div>
        <div className="flex items-end p-2">
          {isRunning ? (
            <Button aria-label="Interrupt" onClick={() => void interrupt()} size="sm" type="button">
              Interrupt
            </Button>
          ) : (
            <Button aria-label="Send message" disabled={!draft.trim()} size="icon-sm" type="submit">
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
