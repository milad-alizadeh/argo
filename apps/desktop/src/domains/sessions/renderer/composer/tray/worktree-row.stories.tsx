import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { WorktreeStart } from '@/domains/sessions/api/worktree-request'
import { AttachmentTray } from './attachment-tray'
import type { PullRequestListing } from './use-worktree-options'
import { WorktreeRow } from './worktree-row'
import '../editor/composer-content.css'

const LONG_BRANCH =
  'argo/#3132-replace-the-work-location-menu-with-a-worktree-switch-and-a-from-branch-picker'

const PULL_REQUESTS: PullRequestListing = {
  type: 'listed',
  pullRequests: [
    { number: 3140, title: 'Replace the work location menu', branch: 'argo/#3132' },
    { number: 3121, title: 'Keep the draft target stable', branch: 'argo/#3085' },
  ],
}

function WorktreeRowStory({
  branch = 'main',
  initialNewWorktree = false,
  pullRequests = { type: 'listed', pullRequests: [] },
  saveFailed = false,
}: {
  branch?: string | null
  initialNewWorktree?: boolean
  pullRequests?: PullRequestListing | null
  saveFailed?: boolean
}) {
  const [newWorktree, setNewWorktree] = useState(initialNewWorktree)
  const [from, setFrom] = useState<WorktreeStart | null>(null)
  const branches = [...new Set([branch ?? 'main', 'main', 'release/1.4', 'design-tokens'])]
  return (
    <div className="flex min-h-dvh items-end p-8">
      <div className="mx-auto w-full max-w-(--size-session-column)">
        <AttachmentTray>
          <WorktreeRow
            options={{ checkout: { path: '/Users/milad/Developer/argo', branch }, branches }}
            newWorktree={newWorktree}
            from={from}
            pullRequests={newWorktree ? pullRequests : null}
            saveFailed={saveFailed}
            onNewWorktreeChange={setNewWorktree}
            onFromChange={setFrom}
          />
        </AttachmentTray>
        <div className="h-24 rounded-xl border border-border bg-card" />
      </div>
    </div>
  )
}

const meta = {
  title: 'Sessions/Composer/Worktree Row',
  component: WorktreeRowStory,
} satisfies Meta<typeof WorktreeRowStory>

export default meta
type Story = StoryObj<typeof WorktreeRowStory>

const page = () => within(document.body)

export const SwitchOff: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('switch', { name: 'Worktree' })).not.toBeChecked()
    await expect(canvas.getByText('main')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /New worktree from/ })).toBeNull()
  },
}

export const SwitchOnWithBranchChosen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'Worktree' }))
    await expect(canvas.getByRole('switch', { name: 'Worktree' })).toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: 'New worktree from main' }))
    const list = await page().findByRole('listbox')
    await expect(within(list).getByRole('option', { name: 'main' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await userEvent.type(page().getByPlaceholderText('Search branches and pull requests'), 'rel')
    await userEvent.click(within(list).getByRole('option', { name: 'release/1.4' }))
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(
      canvas.getByRole('button', { name: 'New worktree from release/1.4' }),
    ).toBeVisible()
  },
}

export const LongBranchName: Story = {
  args: { branch: LONG_BRANCH },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByText(LONG_BRANCH)
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const DropdownWithPullRequests: Story = {
  args: { initialNewWorktree: true, pullRequests: PULL_REQUESTS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New worktree from main' }))
    const list = await page().findByRole('listbox')
    await waitFor(() => expect(within(list).getByText('Pull requests')).toBeVisible())
    await userEvent.type(page().getByPlaceholderText('Search branches and pull requests'), '3085')
    await expect(within(list).queryByRole('option', { name: 'main' })).toBeNull()
    await userEvent.click(
      within(list).getByRole('option', { name: '#3121 Keep the draft target stable' }),
    )
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(
      canvas.getByRole('button', {
        name: 'New worktree from #3121 Keep the draft target stable',
      }),
    ).toBeVisible()
  },
}

export const PullRequestsUnavailable: Story = {
  args: { initialNewWorktree: true, pullRequests: { type: 'unavailable', reason: 'no-remote' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'New worktree from main' }),
    )
    const list = await page().findByRole('listbox')
    await waitFor(() => expect(within(list).getByRole('option', { name: 'main' })).toBeVisible())
    await expect(page().getByText('No GitHub remote, so only branches are listed.')).toBeVisible()
  },
}

export const SwitchNotRemembered: Story = {
  args: { saveFailed: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Could not remember the Worktree switch for this Project.',
    )
  },
}
