import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ComposerForm } from '@/domains/sessions/renderer/composer/layout/composer-form'
import { SessionShell } from './session-shell'
import { AppShellStoryComposition } from '@/platform/renderer/app/components/app-shell.stories'

export function AnchoredWorkspace() {
  const [queryClient] = React.useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <AppShellStoryComposition>
        <SessionShell
          activeEvidenceId={null}
          answeringQuestionId={null}
          composer={
            <ComposerForm
              sessionId="pane-composer"
              focusOnMount={false}
              commands={{ availability: 'listed', commands: [] }}
              tickets={[]}
              plan={{
                state: 'available',
                entries: [{ content: 'Keep the pane opaque', position: 0, status: 'in_progress' }],
              }}
            />
          }
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
        />
      </AppShellStoryComposition>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Features/Sessions/Screens/Workspace',
  component: AnchoredWorkspace,
  excludeStories: ['AnchoredWorkspace'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnchoredWorkspace>
export default meta
type Story = StoryObj<typeof meta>

export const AnchoredComposer: Story = { tags: ['view-only'] }
export const NarrowComposer: Story = {
  decorators: [
    (Story) => (
      <div className="h-full w-[860px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    const editor = canvas.getByRole('combobox', { name: 'Message' })
    await userEvent.type(editor, 'Draft remains usable after collapsing the sidebar.')
    await waitFor(() => expect(editor).toHaveTextContent('Draft remains usable'))
  },
}
export const PlanAtCorner: Story = {
  decorators: [
    (Story) => (
      <div className="h-full w-[1280px]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open task plan' }))
    await waitFor(() =>
      expect(within(document.body).getByText('Keep the pane opaque')).toBeVisible(),
    )
  },
}
