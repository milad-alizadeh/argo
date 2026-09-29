import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { sessionRow } from '../session-fixtures'
import { SessionShell } from './session-shell'

const session = sessionRow({
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
        running={false}
        posture={null}
        onAnswerQuestion={() => {}}
        onOpenEvidence={() => {}}
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
    const header = canvasElement.querySelector<HTMLElement>('[data-component="AppMainHeader"]')
    if (header === null) throw new Error('The Session header is absent.')
    const gutter = Number.parseFloat(getComputedStyle(header).paddingInlineStart)
    await expect(title.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      header.getBoundingClientRect().left + gutter,
    )
    expect(within(header).queryByText('Session ID')).toBeNull()
    expect(within(header).queryByText('Workspace')).toBeNull()
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

export const ResizeExpandedInspector: Story = {
  decorators: [
    (Story) => (
      <div className="h-dvh w-[1280px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(
      () => expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeVisible(),
      { timeout: 5000 },
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open Session inspector' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Expand Session sidebar' }))
    await waitFor(
      () => expect(canvas.getByRole('button', { name: 'Restore Session sidebar' })).toBeVisible(),
      { timeout: 5000 },
    )

    await userEvent.click(canvas.getByRole('button', { name: /^Collapse sidebar$/ }))
    await waitFor(
      () => {
        expect(
          canvas.getByLabelText('Session workspace').getBoundingClientRect().width,
        ).toBeGreaterThan(1)
        expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeVisible()
      },
      { timeout: 10000 },
    )
  },
}
