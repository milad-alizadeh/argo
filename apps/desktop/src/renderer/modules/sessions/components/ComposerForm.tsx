import type { LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import type { RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'
import { ComposerCliToggle } from './ComposerCliToggle'
import { ComposerEditor } from './ComposerEditor'
import { PendingTurns } from './PendingTurns'
import { SessionPlanPopover } from './SessionPlanPopover'
import type { usePendingTurns } from './usePendingTurns'

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
        className={`relative flex overflow-visible rounded-xl border bg-card${plan?.state === 'available' ? ' min-h-40' : ''}`}
      >
        <div className="absolute top-4 right-4 z-20">
          <SessionPlanPopover plan={plan} />
        </div>
        <div className="min-w-0 flex-1">
          <ComposerEditor
            key={sessionId}
            draft={draft}
            editorRef={editorRef}
            onChange={onChange}
            onSend={onSend}
          />
        </div>
        <div className="flex items-end p-2">
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
            <Button aria-label="Send message" disabled={!draft.trim()} size="icon-sm" type="submit">
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
