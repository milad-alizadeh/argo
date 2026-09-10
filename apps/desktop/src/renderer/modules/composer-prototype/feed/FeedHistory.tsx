import { ArrowUpRight, CircleAlert, SquareTerminal } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { FEED_EVIDENCE, type FeedEvidenceAction } from './evidence'
import {
  FeedExpiredPermission,
  FeedPermission,
  FeedQuestion,
  FeedUnreadable,
} from './FeedAttention'
import { FeedDiagramState } from './FeedDiagram'
import { FeedMissingImage } from './FeedImages'
import { FeedBoundary, FeedCode, FeedPrompt } from './FeedPrimitives'
import { FeedMutationExamples } from './FeedTools'

export function FeedHistory({ onOpen }: { onOpen: FeedEvidenceAction }) {
  return (
    <div className="space-y-5" data-component="FeedHistoryStates">
      <FeedPrompt submitted>Keep the draft intact when I switch Projects.</FeedPrompt>
      <FeedBoundary>Earlier records have not been read yet</FeedBoundary>
      <FeedUnreadable />
      <FeedBoundary>Context compacted</FeedBoundary>
      <FeedBoundary>Model changed to Sonnet · Effort high</FeedBoundary>
      <FeedMutationExamples onOpen={onOpen} />
      <Button
        variant="ghost"
        className="h-auto w-full justify-start gap-2 px-2 py-2 text-control font-normal text-destructive"
        onClick={() => onOpen(FEED_EVIDENCE.failed)}
      >
        <SquareTerminal className="!size-(--size-icon-inline)" />
        Ran bun run preview<span className="ml-auto">Failed · Exit 1</span>
      </Button>
      <FeedBoundary>Interrupted</FeedBoundary>
      <div className="flex items-center gap-2 text-control text-muted-foreground">
        <CircleAlert className="!size-(--size-icon-inline)" />
        The process started, but has not produced output.
      </div>
      <FeedBoundary>Resumed after waiting 24s</FeedBoundary>
      <FeedBoundary>Agent reported: Ready for review</FeedBoundary>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 py-2 text-control text-muted-foreground hover:text-foreground"
        onClick={() =>
          onOpen({
            id: 'handoff',
            title: 'Continue Session layout',
            kind: 'document',
            detail: 'Handoff destination · Session',
            source:
              'The remaining work continues in “Continue Session layout”.\n\nThe approved composer, draft and layout notes were included in its handoff.',
          })
        }
      >
        Handed off to Continue Session layout
        <ArrowUpRight className="!size-(--size-icon-inline)" />
      </button>
      <FeedBoundary>
        <span className="sr-only">Turn ended</span>
      </FeedBoundary>
    </div>
  )
}

export function FeedAdditionalStates({ onOpen }: { onOpen: FeedEvidenceAction }) {
  return (
    <div className="space-y-6 border-t pt-6" data-component="FeedAdditionalStates">
      <FeedQuestion />
      <FeedPermission />
      <FeedQuestion readOnly />
      <FeedExpiredPermission />
      <FeedHistory onOpen={onOpen} />
      <FeedMissingImage />
      <FeedDiagramState loading />
      <FeedDiagramState />
      <FeedCode
        language="Unrecognized language · plain text"
        source={'session demo {\n  posture = observed\n  unknown_value = preserved\n}'}
      />
    </div>
  )
}
