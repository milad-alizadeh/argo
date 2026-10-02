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
  disabled = false,
  longOption = false,
  empty = false,
}: {
  initialChoice?: string
  disabled?: boolean
  longOption?: boolean
  empty?: boolean
}) {
  const [selectedId, setSelectedId] = useState(initialChoice)
  let candidates: readonly WorkspaceSummary[] = WORKSPACE_CANDIDATES
  if (empty) candidates = []
  else if (longOption)
    candidates = WORKSPACE_CANDIDATES.map((candidate) =>
      candidate.kind === 'main'
        ? candidate
        : {
            ...candidate,
            displayName: 'A worktree name long enough to check a narrow popup and trigger',
          },
    )
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? null

  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <WorkspaceMenu
        choice={selectedId}
        disabled={disabled}
        onSelect={setSelectedId}
        saveFailed={false}
        workspace={selected}
        workspaces={candidates}
      />
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Workspace Menu',
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
    const search = page().getByPlaceholderText('Search worktrees')
    await expect(search).toHaveValue('')
    await waitFor(() => expect(within(list).getByText('New worktree')).toBeVisible())
    await expect(within(list).getByText('main')).toBeVisible()
    await expect(within(list).getByText('linked-feature')).toBeVisible()
    await userEvent.type(search, 'main')
    await expect(within(list).getByText('main')).toBeVisible()
    await userEvent.clear(search)
    for (const name of ['New worktree', 'main', 'linked-feature']) {
      await expect(
        within(list).getByRole('option', { name }).querySelector('[data-icon]'),
      ).toHaveAttribute('data-icon', 'worktree')
    }

    await userEvent.click(within(list).getByText('linked-feature'))
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(
      canvas.getByRole('button', { name: 'Work location: linked-feature' }),
    ).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Work location: linked-feature' }))
    const reopened = await page().findByRole('listbox')
    await expect(within(reopened).getByRole('option', { name: 'linked-feature' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(within(reopened).getByRole('option', { name: 'New worktree' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  },
}

export const MainCheckout: Story = {
  args: { initialChoice: 'workspace-main' },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Work location: main' })
    await expect(trigger).toBeVisible()
    await expect(trigger.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'worktree')
  },
}

export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Work location: New worktree' }))
    await userEvent.type(page().getByPlaceholderText('Search worktrees'), 'none')
    await expect(page().getByRole('option', { name: 'No worktrees found' })).toBeVisible()
  },
}

export const KeyboardSelectionAndFocusReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Work location: New worktree' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const input = await page().findByRole('combobox', { name: 'Search worktrees' })
    await userEvent.type(input, 'main')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    const selected = canvas.getByRole('button', { name: 'Work location: main' })
    await waitFor(() => expect(selected).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await page().findByRole('listbox')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(selected).toHaveFocus())
  },
}
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toBeDisabled()
  },
}
export const NoExistingWorkspaces: Story = {
  args: { empty: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    const list = await page().findByRole('listbox')
    await expect(within(list).getAllByRole('option')).toHaveLength(1)
    await expect(within(list).getByRole('option', { name: 'New worktree' })).toBeVisible()
  },
}
export const LongOptionNarrowPopup: Story = {
  args: { longOption: true, initialChoice: 'workspace-imported' },
  decorators: [
    (Story) => (
      <div className="w-48">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(
      await page().findByRole('option', {
        name: 'A worktree name long enough to check a narrow popup and trigger',
      }),
    ).toBeVisible()
  },
}
