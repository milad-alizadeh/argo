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

function FeedSkillInvocation({
  onOpen,
  activeEvidenceId,
}: {
  onOpen: FeedEvidenceAction
  activeEvidenceId: string | null
}) {
  const evidence = FEED_EVIDENCE.skill
  const active = activeEvidenceId === evidence.id
  return (
    <Button
      variant="ghost"
      className={`h-auto w-full justify-start gap-2 px-2 py-2 text-(length:--text-control) font-normal ${active ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
      aria-current={active ? 'location' : undefined}
      data-feed-evidence-id={evidence.id}
      onClick={() => onOpen(evidence)}
    >
      <Sparkles className="!size-(--size-icon-inline)" />
      <span>Skill invoked</span>
      <span className="font-medium text-foreground">{evidence.title}</span>
      <BookOpen className="ml-auto !size-(--size-icon-inline)" />
    </Button>
  )
}

export function SessionFeedPrototype({
  onOpenEvidence,
  activeEvidenceId,
}: {
  onOpenEvidence: FeedEvidenceAction
  activeEvidenceId: string | null
}) {
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
        <FeedSkillInvocation onOpen={onOpenEvidence} activeEvidenceId={activeEvidenceId} />
        <details className="group text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-(length:--text-control)">
            <ChevronRight className="!size-(--size-icon-inline) group-open:rotate-90" />
            Reasoning
          </summary>
          <p className="mt-2 border-l pl-4 text-(length:--text-body) leading-relaxed">
            The roster provides context for switching Sessions. Results can use the existing
            sidebar, so the conversation keeps a stable reading width. The approved composer already
            establishes the bottom edge.
          </p>
        </details>
        <div className="flex items-center gap-2 text-(length:--text-control) text-muted-foreground">
          <GitFork className="!size-(--size-icon-inline)" />
          <span>Delegated layout review and feed coverage</span>
          <span className="ml-auto">2 subagents</span>
        </div>
        <FeedToolGroups onOpen={onOpenEvidence} activeEvidenceId={activeEvidenceId} />
      </FeedTurn>
      <FeedRichContent onOpen={onOpenEvidence} />
      <FeedAdditionalStates onOpen={onOpenEvidence} activeEvidenceId={activeEvidenceId} />
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
