import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { WorktreeSummary } from './use-worktree-choices'
import { WorktreeMenu } from './worktree-menu'

const WORKTREE_CANDIDATES: [WorktreeSummary, WorktreeSummary] = [
  { path: '/Users/milad/Developer/argo', main: true, name: 'argo', branch: 'main' },
  {
    path: '/Users/milad/Developer/linked-feature',
    main: false,
    name: 'linked-feature',
    branch: 'feature/linked',
  },
]

function WorktreeStory({
  initialChoice = 'new',
  saveFailed = false,
}: {
  initialChoice?: string
  saveFailed?: boolean
}) {
  const [choice, setChoice] = useState(initialChoice)

  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <WorktreeMenu
        choice={choice}
        onSelect={setChoice}
        saveFailed={saveFailed}
        worktrees={WORKTREE_CANDIDATES}
      />
    </div>
  )
}

const meta = {
  title: 'Sessions/Composer/Worktree Menu',
  component: WorktreeStory,
} satisfies Meta<typeof WorktreeStory>

export default meta
type Story = StoryObj<typeof WorktreeStory>

const page = () => within(document.body)

export const WorktreePicker: Story = {
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
  args: { initialChoice: 'main' },
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

export const UnavailableChoice: Story = {
  args: { initialChoice: '/Users/milad/Developer/removed', saveFailed: true },
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
