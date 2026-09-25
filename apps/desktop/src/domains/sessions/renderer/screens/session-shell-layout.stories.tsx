import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { INACTIVE_FEED_LIVE_FACTS } from '../feed/document/feed-live-facts'
import { sessionRosterRow } from '../session-fixtures'
import { SessionShell } from './session-shell'

const session = sessionRosterRow({
  id: '01K5S9WHWCG1S9K3K88P4JBQBP',
  posture: 'external',
  status: 'idle',
  title: {
    text: 'Keep the sidebar control clear of every Session title at every workspace width',
    source: 'custom',
  },
  cwd: '/workspace/argo/.claude/worktrees/ticket-page-layout',
})

function SessionLayout() {
  return (
    <AppShell
      leftHeader={<span className="type-meta text-muted-foreground">argo</span>}
      sidebar={<aside aria-label="Sessions sidebar" className="h-full bg-sidebar" />}
    >
      <SessionShell
        activeEvidenceId={null}
        answeringQuestionId={null}
        composer={null}
        defaultInspectorCollapsed
        feed={null}
        feedError={null}
        inspector={null}
        liveFacts={INACTIVE_FEED_LIVE_FACTS}
        onAnswerQuestion={() => {}}
        onOpenEvidence={() => {}}
        onOpenSession={() => {}}
        onRetryFeed={() => {}}
        questionFailure={() => null}
        selectedSessionId={null}
        session={session}
      />
    </AppShell>
  )
}

function expectIdentityInPageHeader(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const title = canvas.getByRole('heading', { name: session.title?.text })
  const header = canvasElement.querySelector<HTMLElement>('[data-component="AppMainHeader"]')
  const identity = canvasElement.querySelector<HTMLElement>('[data-component="SessionIdentity"]')
  if (header === null || identity === null)
    throw new Error('The Session layout regions are absent.')
  expect(header.contains(identity)).toBe(true)
  expect(identity.contains(title)).toBe(true)
}

const meta = {
  title: 'Sessions/Screen/Layout',
  component: SessionLayout,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionLayout>

export default meta
type Story = StoryObj<typeof SessionLayout>

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expectIdentityInPageHeader(canvasElement)
    const title = canvas.getByRole('heading', { name: session.title?.text })
    const metadata = canvas
      .getByText('Session ID')
      .closest<HTMLElement>('[data-component="SessionIdMetadata"]')
    if (metadata === null) throw new Error('The Session ID metadata is absent.')
    await expect(metadata).toHaveTextContent(session.id)
    await expect(metadata.querySelector('svg')).not.toBeNull()
    await expect(metadata.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      title.getBoundingClientRect().bottom,
    )
  },
}

export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    const opener = await canvas.findByRole('button', { name: 'Open sidebar' })
    const title = canvas.getByRole('heading', { name: session.title?.text })
    await expect(title.getBoundingClientRect().top).toBeLessThan(
      opener.getBoundingClientRect().bottom,
    )
  },
}
