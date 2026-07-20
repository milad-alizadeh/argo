import type { CiStatus } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CI_RUN_STATUSES, PrChecksList } from './PrChecksList'

// No runtime array of the three ships from `@shared` (only the type) — this is the
// gallery's own list, `satisfies` keeping it a compile error for the union to drift from it.
const CI_STATUSES = ['running', 'passed', 'failed'] as const satisfies readonly CiStatus[]

const RUNS = [
  { name: 'build', status: 'passed', duration: '48s' },
  { name: 'lint', status: 'passed', duration: '12s' },
  { name: 'test', status: 'running', duration: '1m 04s' },
] as const

const meta = {
  title: 'Ship/PrChecksList',
  component: PrChecksList,
  argTypes: {
    sha: { control: 'text' },
    status: { control: 'select', options: CI_STATUSES },
    aggregate: { control: 'text' },
    runs: { control: false },
  },
} satisfies Meta<typeof PrChecksList>

export default meta
type Story = StoryObj<typeof meta>

/** Remote CI in flight — one row still running, deep-linking to its own run. */
export const Default: Story = {
  args: { sha: 'a1b2c3d', status: 'running', aggregate: '1 running · 2 passed', runs: RUNS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('a1b2c3d')).toBeInTheDocument()
    await expect(canvas.getByText('1 running · 2 passed')).toBeInTheDocument()
    await expect(canvas.getAllByRole('button', { name: /open/ })).toHaveLength(RUNS.length)
  },
}

/** A failing run carries its own note beside the glyph — the repair control lives in
 * `NodeDrawer`, not here. */
export const Failed: Story = {
  args: {
    sha: 'a1b2c3d',
    status: 'failed',
    aggregate: '1 failed · 2 passed',
    runs: [
      ...RUNS.slice(0, 2),
      { name: 'test', status: 'failed', duration: '38s', note: '3 failing specs' },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3 failing specs')).toBeInTheDocument()
  },
}

/** Every aggregate tone in one frame — the visual-diff surface for the header's rollup. */
export const EveryStatus: Story = {
  args: { sha: 'a1b2c3d', status: 'running', aggregate: '', runs: [] },
  render: () => (
    <div className="flex flex-col gap-gap">
      {CI_STATUSES.map((status) => (
        <PrChecksList key={status} sha="a1b2c3d" status={status} aggregate={status} runs={RUNS} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const status of CI_STATUSES) {
      await expect(within(canvasElement).getByText(status)).toBeInTheDocument()
    }
  },
}

/** Before GitHub has reported a single run yet — the card still names what it is keyed to. */
export const NoRunsYet: Story = {
  args: { sha: 'a1b2c3d', status: 'running', aggregate: 'queued', runs: [] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('button', { name: /open/ }),
    ).not.toBeInTheDocument()
  },
}

/** Every `CiRunStatus` a single row can carry — queued, running, passed, failed. */
export const EveryRunStatus: Story = {
  args: { sha: 'a1b2c3d', status: 'running', aggregate: '', runs: [] },
  render: () => (
    <PrChecksList
      sha="a1b2c3d"
      status="running"
      aggregate="1 queued · 1 running · 1 passed · 1 failed"
      runs={CI_RUN_STATUSES.map((status) => ({ name: status, status, duration: '—' }))}
    />
  ),
  play: async ({ canvasElement }) => {
    for (const status of CI_RUN_STATUSES) {
      await expect(within(canvasElement).getByText(status)).toBeInTheDocument()
    }
  },
}
