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

// The composer card's column; attached secondary surfaces inset from its edges.
export const COMPOSER_COLUMN = 'mx-auto w-full max-w-(--size-session-column)'

export function ComposerForm({
  disabled = false,
  draft,
  editorRef,
  focusOnMount,
  contextTokens,
  isCompacting,
  onCompact,
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
  disabled?: boolean
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  contextTokens: number | null | undefined
  isCompacting: boolean
  onCompact?: () => Promise<boolean>
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
  const interruptRef = useRef<HTMLButtonElement>(null)
  const wasCompacting = useRef(isCompacting)
  useEffect(() => {
    if (isCompacting && !wasCompacting.current) interruptRef.current?.focus()
    wasCompacting.current = isCompacting
  }, [isCompacting])
  return (
    <form
      className={`${COMPOSER_COLUMN} @container pt-(--spacing-shell-section) pb-(--spacing-session-composer-bottom)`}
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
      <div className="relative">
        <div
          data-component="ComposerCard"
          className={`@container relative z-10 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-surface)${plan?.state === 'available' ? ' min-h-(--size-composer-plan-state)' : ''}${disabled ? ' opacity-60' : ''}`}
        >
          <div className="absolute top-(--spacing-shell-inset) right-(--spacing-shell-inset) z-20">
            <SessionPlanPopover plan={plan} />
          </div>
          <div className="relative min-w-0 flex-1">
            <ComposerEditor
              key={sessionId}
              cli={harness?.cli ?? null}
              draft={draft}
              editorRef={editorRef}
              focusOnMount={focusOnMount}
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
                  disabled={!draft.trim() || disabled}
                  size="icon-sm"
                  type="submit"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="absolute inset-x-(--spacing-shell-gutter) top-full z-0 -mt-2">
          <SessionContextBar
            contextTokens={contextTokens}
            harness={harness?.cli}
            isCompacting={isCompacting}
            onCompact={onCompact}
          />
        </div>
      </div>
    </form>
  )
}
