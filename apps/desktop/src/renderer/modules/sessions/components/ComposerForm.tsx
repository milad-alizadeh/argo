import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import type { RefObject } from 'react'
import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'
import { ComposerCliToggle } from './ComposerCliToggle'
import { ModeMenu } from './ModeMenu'
import { PendingTurns } from './PendingTurns'
import { RunSetupMenu, type TurnSetupControlProps } from './RunSetupMenu'
import { SessionPlanPopover } from './SessionPlanPopover'
import type { usePendingTurns } from './usePendingTurns'

function editorState(text: string) {
  return () => {
    const root = $getRoot()
    root.clear()
    root.append($createParagraphNode().append($createTextNode(text)))
  }
}

function ComposerEditor({
  draft,
  editorRef,
  onChange,
  onSend,
}: {
  draft: string
  editorRef: RefObject<LexicalEditor | null>
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
            className="min-h-20 flex-1 whitespace-pre-wrap px-4 py-3 pr-28 text-sm leading-6 outline-none"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              onSend()
            }}
            placeholder={
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 px-4 py-3 text-sm text-muted-foreground"
              >
                Direct the next move…
              </span>
            }
          />
        }
        placeholder={
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 px-4 py-3 text-sm text-muted-foreground"
          >
            Direct the next move…
          </span>
        }
      />
      <OnChangePlugin
        onChange={(state) => state.read(() => onChange($getRoot().getTextContent()))}
      />
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  )
}

export function ComposerForm({
  cliPicker,
  draft,
  editorRef,
  isRunning,
  onChange,
  onEdit,
  onInterrupt,
  onRemove,
  onReorder,
  onSend,
  pendingTurns,
  plan,
  sessionId,
  setup,
}: {
  cliPicker?: { cli: SessionCli; onChangeCli: (cli: SessionCli) => void } | null
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  isRunning: boolean
  onChange: (text: string) => void
  onEdit: (turn: (typeof pendingTurns)[number]) => void
  onInterrupt?: () => Promise<boolean>
  onRemove: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
  onSend: () => void
  pendingTurns: ReturnType<typeof usePendingTurns>['pendingTurns']
  plan: SessionPlan | null
  sessionId: string
  setup: TurnSetupControlProps | null
}) {
  return (
    <form
      className="mx-auto w-full max-w-4xl px-(--spacing-shell-gutter) pt-6 pb-8"
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      {cliPicker ? (
        <ComposerCliToggle cli={cliPicker.cli} onChangeCli={cliPicker.onChangeCli} />
      ) : null}
      <PendingTurns
        turns={pendingTurns}
        onEdit={onEdit}
        onRemove={onRemove}
        onReorder={onReorder}
      />
      <div
        className={`@container relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg shadow-foreground/10${plan?.state === 'available' ? ' min-h-40' : ''}`}
      >
        <div className="absolute top-4 right-4 z-20">
          <SessionPlanPopover plan={plan} />
        </div>
        <div className="relative min-w-0 flex-1">
          <ComposerEditor
            key={sessionId}
            draft={draft}
            editorRef={editorRef}
            onChange={onChange}
            onSend={onSend}
          />
        </div>
        <div className="flex items-center gap-1 p-2 @[36rem]:gap-2">
          {setup ? <RunSetupMenu {...setup} /> : null}
          <div className="ml-auto flex items-center gap-1">
            {setup ? <ModeMenu {...setup} /> : null}
            {isRunning ? (
              <Button
                aria-label="Interrupt"
                onClick={() => void onInterrupt?.()}
                size="sm"
                type="button"
              >
                Interrupt
              </Button>
            ) : (
              <Button
                aria-label="Send message"
                disabled={!draft.trim()}
                size="icon-sm"
                type="submit"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
