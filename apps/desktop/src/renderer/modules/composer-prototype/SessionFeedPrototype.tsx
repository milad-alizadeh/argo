import { BookOpen, ChevronRight, GitFork, Sparkles } from 'lucide-react'
import { Button } from '@/renderer/components/ui/button'
import { FEED_EVIDENCE, type FeedEvidenceAction } from './feed/evidence'
import { FeedAdditionalStates } from './feed/FeedHistory'
import { FeedAttachedImage } from './feed/FeedImages'
import { FeedBoundary, FeedPrompt, FeedTurn } from './feed/FeedPrimitives'
import { FeedRichContent } from './feed/FeedRichContent'
import { FeedPendingCall, FeedToolGroups } from './feed/FeedTools'

export type { FeedPrototypeEvidence } from './feed/evidence'
export { FeedEvidencePrototype } from './feed/FeedEvidencePrototype'

export function SessionFeedPrototype({ onOpenEvidence }: { onOpenEvidence: FeedEvidenceAction }) {
  return (
    <div className="min-w-0 space-y-6 text-body" data-component="SessionFeedPrototype">
      <FeedBoundary>Today · 10:42</FeedBoundary>
      <FeedPrompt>
        <p>
          Bring the composer into the Session. Keep the roster, subagents and their shell visible,
          and use this image to check attachments.
        </p>
        <FeedAttachedImage />
      </FeedPrompt>
      <FeedTurn>
        <p className="leading-relaxed">
          I’ll connect the composer to the surrounding Session and check the rich content at the
          same time.
        </p>
        <Button
          variant="ghost"
          className="h-auto justify-start gap-2 px-0 text-(length:--text-control) font-normal text-muted-foreground"
          onClick={() => onOpenEvidence(FEED_EVIDENCE.skill)}
        >
          <Sparkles className="!size-(--size-icon-inline)" />
          Loaded prototype
          <BookOpen className="!size-(--size-icon-inline)" />
        </Button>
        <details className="group text-control text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <ChevronRight className="!size-(--size-icon-inline) group-open:rotate-90" />
            Reasoning
          </summary>
          <p className="mt-2 border-l pl-4 leading-relaxed">
            The roster provides context for switching Sessions. Results can use the existing
            sidebar, so the conversation keeps a stable reading width. The approved composer already
            establishes the bottom edge.
          </p>
        </details>
        <div className="flex items-center gap-2 text-control text-muted-foreground">
          <GitFork className="!size-(--size-icon-inline)" />
          <span>Delegated layout review and feed coverage</span>
          <span className="ml-auto">2 subagents</span>
        </div>
        <FeedToolGroups onOpen={onOpenEvidence} />
      </FeedTurn>
      <FeedRichContent onOpen={onOpenEvidence} />
      <FeedAdditionalStates onOpen={onOpenEvidence} />
      <FeedBoundary>
        <span className="sr-only">Turn ended</span>
      </FeedBoundary>
      <FeedPrompt>
        That looks right. Check ten attachments and keep the message field at the same width.
      </FeedPrompt>
      <FeedTurn>
        <p className="leading-relaxed">
          I’m checking the stress state now. The layout review is still running in the sidebar.
        </p>
        <FeedPendingCall />
      </FeedTurn>
    </div>
  )
}
