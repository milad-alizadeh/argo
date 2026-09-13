import type { LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import type { RefObject } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import type { HarnessControl } from '../harness/harnesses'
import { ModeMenu } from './ModeMenu'
import { PendingTurns } from './PendingTurns'
import { RunSetupMenu, type TurnSetupControlProps } from './RunSetupMenu'
import { ComposerEditor } from './SessionComposerEditor'
import { SessionPlanPopover } from './SessionPlanPopover'
import type { usePendingTurns } from './usePendingTurns'

// The column the composer card sits in; a message about the composer shares it, so it is never wider.
export const COMPOSER_COLUMN =
  'mx-auto w-full max-w-(--size-session-column) px-(--spacing-shell-gutter)'

export function ComposerForm({
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
  harness,
  setup,
}: {
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
  harness: HarnessControl | null
  setup: TurnSetupControlProps | null
}) {
  return (
    <form
      className={`${COMPOSER_COLUMN} pt-(--spacing-shell-section) pb-(--spacing-shell-region)`}
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <PendingTurns
        turns={pendingTurns}
        onEdit={onEdit}
        onRemove={onRemove}
        onReorder={onReorder}
      />
      <div
        className={`@container relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/10${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}`}
      >
        <div className="absolute top-(--spacing-shell-inset) right-(--spacing-shell-inset) z-20">
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
        <div className="flex items-center gap-1 p-(--spacing-shell-item) @[36rem]:gap-2">
          {harness ? <RunSetupMenu harness={harness} setup={setup} /> : null}
          <div className="ml-auto flex items-center gap-1">
            {setup ? <ModeMenu {...setup} /> : null}
            {isRunning ? (
              <Button
                aria-label="Interrupt"
                className="type-composer-control"
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
