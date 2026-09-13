import type { LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import type { RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'
import { ComposerCliToggle } from './ComposerCliToggle'
import { ComposerEditor } from './SessionComposerEditor'
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
      className="mx-auto w-full max-w-(--size-session-column) px-(--spacing-shell-gutter) pt-(--spacing-shell-section) pb-(--spacing-shell-region)"
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
        className={`relative flex min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/10${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}`}
      >
        <div className="absolute top-(--spacing-shell-inset) right-(--spacing-shell-inset) z-20">
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
        <div className="flex items-end p-(--spacing-shell-item)">
          {isRunning ? (
            <Button
              aria-label="Interrupt"
              className="type-composer-control"
              onClick={() => void onInterrupt?.()}
              type="button"
            >
              Interrupt
            </Button>
          ) : (
            <Button aria-label="Send message" disabled={!draft.trim()} size="icon" type="submit">
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
