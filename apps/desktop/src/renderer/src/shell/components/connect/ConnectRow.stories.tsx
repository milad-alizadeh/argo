import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ConnectRowView } from '../../connect/connectPanelModel'
import { ConnectRow } from './ConnectRow'

const OFFERED: ConnectRowView = {
  key: 'connections',
  title: 'GitHub',
  benefit: 'See your backlog, your pull requests and their checks next to the work.',
  value: null,
  done: false,
  action: 'Sign in to GitHub',
}

const meta = {
  title: 'Shell/ConnectPanel/ConnectRow',
  component: ConnectRow,
  args: { row: OFFERED, onAct: fn() },
  argTypes: { row: { control: 'object', table: { type: { summary: 'ConnectRowView' } } } },
} satisfies Meta<typeof ConnectRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A row still on offer.
 *
 * Its mark is hollow and its copy is the plain benefit of doing it — never the honesty tier it
 * would light up, which is exactly the ladder #165 cut.
 */
export const Offered: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement)
    await expect(row.getByRole('img', { name: 'Not set' })).toBeVisible()
    await userEvent.click(row.getByRole('button', { name: 'Sign in to GitHub' }))
    await expect(args.onAct).toHaveBeenCalled()
  },
}

/** A row that is done, showing what it is set to under the same benefit copy. */
export const Done: Story = {
  args: { row: { ...OFFERED, value: 'Signed in', done: true, action: 'Sign in again' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Done' })).toBeVisible()
  },
}

/**
 * A row with nothing Argo can do yet.
 *
 * The companion plugin has no install path in this build, so the row says so rather than
 * showing a button that would do nothing.
 */
export const NoAction: Story = {
  args: {
    row: {
      key: 'plugin',
      title: 'Companion plugin',
      benefit: 'Lets Argo see what an agent is waiting on and steer it, not just watch it.',
      value: 'Not available yet',
      done: false,
      action: null,
    },
  },
}
