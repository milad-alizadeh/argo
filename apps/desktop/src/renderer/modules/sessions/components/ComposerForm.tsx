import type { LexicalEditor } from 'lexical'
import { ArrowUp, Square } from 'lucide-react'
import { type RefObject, useEffect, useRef } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import { Button } from '../../../components/ui/button'
import type { HarnessControl } from '../harness/harnesses'
import { ModeMenu } from './ModeMenu'
import { PendingTurns } from './PendingTurns'
import { RunSetupMenu, type TurnSetupControlProps } from './RunSetupMenu'
import { ComposerEditor } from './SessionComposerEditor'
import { SessionContextBar } from './SessionContextBar'
import { SessionPlanPopover } from './SessionPlanPopover'
import type { usePendingTurns } from './usePendingTurns'

// The column the composer card sits in; a message about the composer shares it, so it is never wider.
export const COMPOSER_COLUMN =
  'mx-auto w-full max-w-(--size-session-column) px-(--spacing-shell-gutter)'

export function ComposerForm({
  draft,
  editorRef,
  contextTokens,
  isRunning,
  isCompacting,
  onCompact,
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
  contextTokens: number | null | undefined
  isRunning: boolean
  isCompacting: boolean
  onCompact?: () => Promise<boolean>
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
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)

  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])

  return (
    <form
      className={`${COMPOSER_COLUMN} @container pt-(--spacing-shell-section) pb-(--spacing-shell-region)`}
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
        <div className="flex items-center gap-1 pt-(--spacing-shell-item) pr-(--spacing-shell-item) pb-(--spacing-shell-gutter) pl-(--spacing-shell-item) @[36rem]:gap-2">
          {harness ? <RunSetupMenu harness={harness} setup={setup} /> : null}
          <div className="ml-auto flex items-center gap-1">
            {setup ? <ModeMenu {...setup} /> : null}
            {isRunning ? (
              <Button
                aria-label="Interrupt"
                onClick={() => void onInterrupt?.()}
                ref={interruptRef}
                size="icon-sm"
                type="button"
              >
                <Square fill="currentColor" />
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
      <SessionContextBar
        contextTokens={contextTokens}
        harness={harness?.cli}
        isCompacting={isCompacting}
        onCompact={onCompact}
      />
    </form>
  )
}
