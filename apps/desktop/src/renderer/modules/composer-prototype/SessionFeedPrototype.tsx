import { BrainIcon, GitFork, Sparkles } from 'lucide-react'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
import { FEED_EVIDENCE, type FeedEvidenceAction } from './feed/evidence'
import { FeedMarkdown } from './feed/FeedEvidenceBody'
import { FeedAdditionalStates } from './feed/FeedHistory'
import { FeedAttachedImage } from './feed/FeedImages'
import { FeedPendingCall } from './feed/FeedPendingCall'
import { FeedBoundary, FeedPrompt, FeedTurn } from './feed/FeedPrimitives'
import { FeedRichContent } from './feed/FeedRichContent'
import { FeedToolGroups } from './feed/FeedTools'

export type { FeedPrototypeEvidence } from './feed/evidence'
export { FeedEvidencePrototype } from './feed/FeedEvidencePrototype'

function FeedSkillInvocation() {
  const evidence = FEED_EVIDENCE.skill
  return (
    <CollapsibleText
      icon={Sparkles}
      title={
        <>
          Skill invoked <span className="font-medium text-foreground">{evidence.title}</span>
        </>
      }
      content={<FeedMarkdown source={evidence.source} />}
    />
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
    <div className="min-w-0 space-y-6 type-body" data-component="SessionFeedPrototype">
      <FeedBoundary>Today · 10:42</FeedBoundary>
      <FeedPrompt>
        <p>
          Bring the composer into the Session. Keep the roster, subagents and their shell visible,
          and use this image to check attachments.
        </p>
        <FeedAttachedImage />
      </FeedPrompt>
      <FeedTurn>
        <p className="type-prose">
          I’ll connect the composer to the surrounding Session and check the rich content at the
          same time.
        </p>
        <FeedSkillInvocation />
        <CollapsibleText
          icon={BrainIcon}
          title="Reasoning"
          content={
            <p className="type-prose text-muted-foreground">
              The roster provides context for switching Sessions. Results can use the existing
              sidebar, so the conversation keeps a stable reading width. The approved composer
              already establishes the bottom edge.
            </p>
          }
        />
        <div className="flex items-center gap-2 type-body text-muted-foreground">
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
        <p className="type-prose">
          I’m checking the stress state now. The layout review is still running in the sidebar.
        </p>
        <FeedPendingCall />
      </FeedTurn>
    </div>
  )
}
