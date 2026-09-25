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

function WorkspaceStory() {
  const [selectedId, setSelectedId] = useState(WORKSPACE_CANDIDATES[0].id)
  const selected = WORKSPACE_CANDIDATES.find((candidate) => candidate.id === selectedId) ?? null

  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <WorkspaceMenu
        onSelect={setSelectedId}
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
    const trigger = canvas.getByRole('button', { name: 'Choose Workspace: argo' })

    await userEvent.click(trigger)
    const menu = await page().findByRole('menu')
    await expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['argomain', 'linked-featurefeature/linked'])

    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /linked-feature/ }))
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
  },
}
