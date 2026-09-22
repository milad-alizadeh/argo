import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { SessionComposer } from '@/domains/sessions/renderer/composer/session-composer'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'
import { BasicFeed } from '@/domains/sessions/renderer/feed/basic-feed'
import { INACTIVE_FEED_LIVE_FACTS } from '@/domains/sessions/renderer/feed/feed-live-facts'
import type { SessionFeed } from '@/domains/sessions/renderer/types'

const COMPACTION_FEED = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'storybook-compaction',
  sessionId: 'compacting-session',
  chainId: 'compacting-session',
  revision: 'one',
  rows: [{ shape: 'prose', id: 'prompt', role: 'user', text: 'Condense the Session.' }],
} satisfies SessionFeed

function CompactingComposerStory() {
  const [compacting, setCompacting] = useState(false)

  return (
    <div className="mx-auto flex h-dvh w-full max-w-none flex-col p-8">
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          failure={null}
          feed={COMPACTION_FEED}
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          liveFacts={{
            ...INACTIVE_FEED_LIVE_FACTS,
            compactionPercentage: compacting ? 22 : null,
            compactionStartedAt: compacting ? '2026-09-13T22:01:00.000Z' : null,
            compactionTokens: compacting ? '10.1k tokens' : null,
            isRunning: compacting,
          }}
          selectedSessionId="compacting-session"
        />
      </div>
      <SessionComposer
        contextTokens={148_000}
        isCompacting={compacting}
        isRunning={compacting}
        onCompact={async () => {
          setCompacting(true)
          return true
        }}
        onSend={async () => true}
        sessionId="compacting-session"
      />
    </div>
  )
}

const meta = {
  title: 'Sessions/Composer/Compaction',
  component: CompactingComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? 'w-full'}>
        <Story />
      </div>
    ),
  ],
  // Drafts outlive a story like they outlive a page, so each story starts from none.
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
} satisfies Meta<typeof CompactingComposerStory>

export default meta
type Story = StoryObj<typeof CompactingComposerStory>

export const CompactionStarts: Story = {
  parameters: { frame: 'w-full' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Compact context' }))
    const interrupt = await canvas.findByRole('button', { name: 'Interrupt' })
    await expect(interrupt).toBeDisabled()
    await expect(canvas.getByText('Compacting conversation…')).toBeVisible()
    await expect(canvas.getByText('22%')).toBeVisible()
  },
}
