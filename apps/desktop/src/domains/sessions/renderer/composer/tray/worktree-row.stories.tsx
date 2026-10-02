import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AttachmentTray } from './attachment-tray'
import { WorktreeRow } from './worktree-row'
import '../editor/composer-content.css'

const LONG_BRANCH =
  'argo/#3132-replace-the-work-location-menu-with-a-worktree-switch-and-a-from-branch-picker'

function WorktreeRowStory({
  branch = 'main',
  initialNewWorktree = false,
  saveFailed = false,
  narrow = false,
  loading = false,
}: {
  branch?: string | null
  initialNewWorktree?: boolean
  saveFailed?: boolean
  // A fixed narrow column, so a long branch truncates at any viewport width.
  narrow?: boolean
  loading?: boolean
}) {
  const [newWorktree, setNewWorktree] = useState(initialNewWorktree)
  const [from, setFrom] = useState<string | null>(null)
  const branches = [...new Set([branch ?? 'main', 'main', 'release/1.4', 'design-tokens'])]
  return (
    <div className="flex min-h-dvh items-end p-8">
      <div className={`mx-auto w-full ${narrow ? 'max-w-96' : 'max-w-(--size-session-column)'}`}>
        <AttachmentTray>
          <WorktreeRow
            options={
              loading
                ? null
                : { checkout: { path: '/Users/milad/Developer/argo', branch }, branches }
            }
            newWorktree={newWorktree}
            from={from}
            saveFailed={saveFailed}
            setNewWorktree={setNewWorktree}
            chooseFrom={setFrom}
          />
        </AttachmentTray>
        <div className="relative z-10 h-24 rounded-xl border border-border bg-card" />
      </div>
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Worktree Row',
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

export const LabelTogglesTheSwitch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Worktree'))
    await expect(canvas.getByRole('switch', { name: 'Worktree' })).toBeChecked()
    await expect(canvas.getByRole('button', { name: 'New worktree from main' })).toBeVisible()
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
    await userEvent.type(page().getByPlaceholderText('Search branches'), 'rel')
    await userEvent.click(within(list).getByRole('option', { name: 'release/1.4' }))
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(
      canvas.getByRole('button', { name: 'New worktree from release/1.4' }),
    ).toBeVisible()
  },
}

export const KeyboardSelectionAndFocusReturn: Story = {
  args: { initialNewWorktree: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'New worktree from main' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const search = await page().findByRole('combobox', { name: 'Search branches' })
    await waitFor(() => expect(search).toHaveFocus())
    await userEvent.type(search, 'release')
    await expect(page().getByRole('option', { name: 'release/1.4' })).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    const selectedTrigger = canvas.getByRole('button', { name: 'New worktree from release/1.4' })
    await expect(selectedTrigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const list = await page().findByRole('listbox')
    await expect(within(list).getByRole('option', { name: 'release/1.4' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(selectedTrigger).toHaveFocus()
  },
}

export const NoMatches: Story = {
  args: { initialNewWorktree: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'New worktree from main' })
    await userEvent.click(trigger)
    await userEvent.type(
      await page().findByRole('combobox', { name: 'Search branches' }),
      'missing',
    )
    await expect(page().getByRole('option', { name: 'No branches found' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole('switch', { name: 'Worktree' })
    await expect(control).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(control)
    await expect(control).not.toBeChecked()
  },
}

export const LongBranchPicker: Story = {
  args: { branch: LONG_BRANCH, initialNewWorktree: true, narrow: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: `New worktree from ${LONG_BRANCH}` }),
    )
    await expect(await page().findByRole('option', { name: LONG_BRANCH })).toHaveAttribute(
      'aria-current',
      'true',
    )
  },
}

export const LongBranchName: Story = {
  args: { branch: LONG_BRANCH, narrow: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByText(LONG_BRANCH)
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
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
