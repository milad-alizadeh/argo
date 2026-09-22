import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SessionPlanPopover } from '@/domains/sessions/renderer/composer/session-plan-popover'

const meta = {
  title: 'Sessions/Composer/Plan',
  component: SessionPlanPopover,
} satisfies Meta<typeof SessionPlanPopover>

export default meta
type Story = StoryObj<typeof SessionPlanPopover>

const plan = {
  state: 'available' as const,
  entries: [
    { content: 'Map composer information', position: 0, status: 'completed' as const },
    { content: 'Choose the base layout', position: 1, status: 'in_progress' as const },
    { content: 'Prepare implementation handoff', position: 2, status: 'pending' as const },
  ],
}

async function opensPlan(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Open task plan' })
  await userEvent.tab()
  await expect(trigger).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  return trigger
}

async function hoversPlan(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Open task plan' })
  await userEvent.hover(trigger)
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
  return trigger
}

function planContent(trigger: HTMLElement) {
  const contentId = trigger.getAttribute('aria-controls')
  const contents =
    contentId === null ? [] : [...document.querySelectorAll<HTMLElement>(`[id="${contentId}"]`)]
  const content = contents.find((candidate) => candidate.dataset.open !== undefined) ?? null
  if (content === null) throw new Error('The Plan popover did not render.')
  return content
}

async function shownPlanContent(trigger: HTMLElement) {
  let content: HTMLElement | null = null
  await waitFor(() => {
    content = planContent(trigger)
    expect(content).toBeVisible()
  })
  if (content === null) throw new Error('The Plan popover did not open.')
  return within(content)
}

export const Available: Story = {
  args: { plan },
  play: async ({ canvasElement }) => {
    const trigger = await opensPlan(canvasElement)
    const popover = await shownPlanContent(trigger)
    await expect(await popover.findByRole('list', { name: 'Task plan' })).toBeVisible()
    await expect(popover.getByText('Map composer information')).toBeVisible()
    await expect(popover.getByText('Choose the base layout')).toBeVisible()
    await expect(popover.getByText('Prepare implementation handoff')).toBeVisible()
    await expect(
      popover.getByRole('listitem', { name: 'Choose the base layout: In progress' }),
    ).toBeVisible()
  },
}

export const OpensOnHover: Story = {
  args: { plan },
  play: async ({ canvasElement }) => {
    const trigger = await hoversPlan(canvasElement)
    const popover = await shownPlanContent(trigger)
    await expect(popover.getByRole('list', { name: 'Task plan' })).toBeVisible()
  },
}

export const RepeatedEntryText: Story = {
  args: {
    plan: {
      state: 'available',
      entries: [
        { content: 'Review the Plan', position: 0, status: 'pending' },
        { content: 'Review the Plan', position: 1, status: 'in_progress' },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = await opensPlan(canvasElement)
    const popover = await shownPlanContent(trigger)
    await expect(popover.getAllByRole('listitem', { name: /Review the Plan/ })).toHaveLength(2)
  },
}

export const Empty: Story = {
  args: { plan: { state: 'available', entries: [] } },
  play: async ({ canvasElement }) => {
    const trigger = await opensPlan(canvasElement)
    await expect(
      (await shownPlanContent(trigger)).getByText('The agent has not added any steps.'),
    ).toBeVisible()
  },
}
