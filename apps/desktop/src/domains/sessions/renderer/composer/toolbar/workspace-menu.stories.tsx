import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { WorkspaceSummary } from '@/domains/workspaces/renderer'
import { WorkspaceMenu } from './workspace-menu'

const WORKSPACE_CANDIDATES: [WorkspaceSummary, WorkspaceSummary] = [
  {
    id: 'workspace-main',
    kind: 'main',
    displayName: 'argo',
    path: '/Users/milad/Developer/argo',
    facts: { branch: 'main', headSha: 'abc1234', dirty: false },
  },
  {
    id: 'workspace-imported',
    kind: 'imported',
    displayName: 'linked-feature',
    path: '/Users/milad/Developer/argo-linked',
    facts: { branch: 'feature/linked', headSha: 'def5678', dirty: true },
  },
]

function WorkspaceStory({
  initialChoice = 'new',
  saveFailed = false,
}: {
  initialChoice?: string
  saveFailed?: boolean
}) {
  const [selectedId, setSelectedId] = useState(initialChoice)
  const selected = WORKSPACE_CANDIDATES.find((candidate) => candidate.id === selectedId) ?? null

  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <WorkspaceMenu
        choice={selectedId}
        onSelect={setSelectedId}
        saveFailed={saveFailed}
        workspace={selected}
        workspaces={WORKSPACE_CANDIDATES}
      />
    </div>
  )
}

const meta = {
  title: 'Sessions/Composer/Workspace Menu',
  component: WorkspaceStory,
} satisfies Meta<typeof WorkspaceStory>

export default meta
type Story = StoryObj<typeof WorkspaceStory>

const page = () => within(document.body)

export const WorkspacePicker: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Work location: New worktree' })

    await userEvent.click(trigger)
    const list = await page().findByRole('listbox')
    await waitFor(() => expect(within(list).getByText('New worktree')).toBeVisible())
    await expect(within(list).getByText('Main checkout')).toBeVisible()
    await expect(within(list).getByText('linked-feature')).toBeVisible()

    await userEvent.click(within(list).getByText('linked-feature'))
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(
      canvas.getByRole('button', { name: 'Work location: linked-feature' }),
    ).toBeVisible()
  },
}

export const UnavailableChoice: Story = {
  args: { initialChoice: 'missing-workspace', saveFailed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: 'Work location: Choose work location' }),
    ).toBeVisible()
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Could not use this work location. Choose another.',
    )
  },
}
