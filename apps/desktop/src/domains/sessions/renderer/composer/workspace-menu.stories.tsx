import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { WorkspaceSummary } from '@/domains/projects/contract/workspace-messages'
import { WorkspaceMenu } from './workspace-menu'

const WORKSPACE_CANDIDATES: [WorkspaceSummary, WorkspaceSummary, WorkspaceSummary] = [
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
  {
    id: 'workspace-managed',
    kind: 'managed',
    displayName: 'ticket-2600-project-workspaces',
    path: '/Users/milad/Developer/argo/.claude/worktrees/ticket-2600-project-workspaces',
    facts: { branch: 'argo/#2600-project-workspaces', headSha: 'ghi9012', dirty: false },
  },
]

function WorkspaceStory() {
  const [selectedId, setSelectedId] = useState(WORKSPACE_CANDIDATES[0].id)
  const [createdCount, setCreatedCount] = useState(0)
  const selected = WORKSPACE_CANDIDATES.find((candidate) => candidate.id === selectedId) ?? null

  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <WorkspaceMenu
        onCreateManaged={() => setCreatedCount((count) => count + 1)}
        onSelect={setSelectedId}
        workspace={selected}
        workspaces={WORKSPACE_CANDIDATES}
      />
      <output className="mt-4 block type-body" data-testid="created-count">
        {createdCount}
      </output>
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
    ).toEqual([
      'argomain',
      'linked-featurefeature/linked',
      'ticket-2600-project-workspacesargo/#2600-project-workspaces',
    ])

    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /linked-feature/ }))
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())

    const reopenTrigger = canvas.getByRole('button', { name: 'Choose Workspace: linked-feature' })
    await userEvent.click(reopenTrigger)
    const reopened = await page().findByRole('menu')
    await userEvent.click(within(reopened).getByRole('menuitem', { name: 'New managed Workspace' }))
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(canvas.getByTestId('created-count')).toHaveTextContent('1')
  },
}
