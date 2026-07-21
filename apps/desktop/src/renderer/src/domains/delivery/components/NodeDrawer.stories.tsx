import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { NodeDrawer, type NodeDrawerSession } from './NodeDrawer'

const SESSION: NodeDrawerSession = {
  commits: { dirty: 3, headSha: null, unpushed: 0, draftMessage: 'feat: rotate auth tokens' },
  pr: { headSha: 'a1b2c3d' },
  ci: {
    sha: 'a1b2c3d',
    status: 'running',
    aggregate: '1 running · 2 passed',
    runs: [
      { name: 'build', status: 'passed', duration: '48s' },
      { name: 'test', status: 'running', duration: '1m 04s' },
    ],
  },
  review: { rounds: [] },
  merge: { prNum: 42, headSha: 'a1b2c3d' },
  merged: { sha: '9f1c2ab', how: 'squash', by: 'milad', when: '2h ago' },
  closed: { by: 'milad', when: '1d ago', note: 'superseded by #47' },
}

const meta = {
  title: 'Delivery/NodeDrawer',
  component: NodeDrawer,
  argTypes: {
    node: { control: false },
    state: { control: false },
    isHead: { control: 'boolean' },
    session: { control: false },
  },
} satisfies Meta<typeof NodeDrawer>

export default meta
type Story = StoryObj<typeof meta>

/** S1: an agent owns the stage — narrated, zero buttons (R2). */
export const CommitsNow: Story = {
  args: { node: 'commits', state: 'now', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/will commit when the slice is done/),
    ).toBeInTheDocument()
  },
}

/** S2: dirty + idle — the drafted commit message and, on the head, the repair control. */
export const CommitsGate: Story = {
  args: { node: 'commits', state: 'gate', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('feat: rotate auth tokens')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /Commit 3 files/ })).toBeInTheDocument()
  },
}

/** R2: inspecting a non-head node — the same body, no control. */
export const CommitsGateNotHead: Story = {
  args: { node: 'commits', state: 'gate', isHead: false, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole('button', { name: /Commit/ }),
    ).not.toBeInTheDocument()
  },
}

/** S9: post-PR sync (R5) — pushing re-runs CI and re-requests review. */
export const CommitsSync: Story = {
  args: {
    node: 'commits',
    state: 'sync',
    isHead: true,
    session: {
      ...SESSION,
      commits: { dirty: 0, headSha: 'e4f5a6b', unpushed: 1, draftMessage: '' },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Push 1/ })).toBeInTheDocument()
  },
}

/** R11: the Commits drawer is the sha-keyed home for a local check's captured output. */
export const CommitsWithCheckOutput: Story = {
  args: {
    node: 'commits',
    state: 'done',
    isHead: false,
    session: {
      ...SESSION,
      commits: {
        dirty: 0,
        headSha: 'e4f5a6b',
        unpushed: 0,
        draftMessage: '',
        selectedCheck: { check: 'lint', command: 'bun run lint', output: 'clean' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Lint')).toBeInTheDocument()
  },
}

/** S3: GATE 1 — Create PR arms on the first click and confirms on the second. */
export const PrGate: Story = {
  args: { node: 'pr', state: 'gate', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: /Create PR → main/ })
    await userEvent.click(button)
    await expect(canvas.getByRole('button', { name: /Confirm — create PR/ })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'cancel' })).toBeInTheDocument()
  },
}

/** S3b: delegated — narrates the standing order, carries the one revoke (R6). */
export const PrAuto: Story = {
  args: { node: 'pr', state: 'auto', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Argo opens the PR/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'revoke' })).toBeInTheDocument()
  },
}

/** Inspecting the PR node once it is open — info only. */
export const PrDone: Story = {
  args: { node: 'pr', state: 'done', isHead: false, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/live on the strip anchor/)).toBeInTheDocument()
  },
}

/** S4: CI running, none failed — no repair row. */
export const CiRunning: Story = {
  args: { node: 'ci', state: 'now', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('a1b2c3d')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /Fix CI/ })).not.toBeInTheDocument()
  },
}

/** S5: a failing head node dispatches (Fix CI) or repairs directly (Re-run). */
export const CiFailingHead: Story = {
  args: {
    node: 'ci',
    state: 'fail',
    isHead: true,
    session: {
      ...SESSION,
      ci: {
        sha: 'a1b2c3d',
        status: 'failed',
        aggregate: '1 failed · 2 passed',
        runs: [{ name: 'test', status: 'failed', duration: '38s' }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Fix CI/ })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /Re-run/ })).toBeInTheDocument()
  },
}

/** No review yet — the designed empty state, not a smaller number. */
export const ReviewEmpty: Story = {
  args: { node: 'review', state: 'wait', isHead: false, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('no review yet')).toBeInTheDocument()
  },
}

/** S7: changes requested — the head dispatches Address on the open findings. */
export const ReviewChangesRequested: Story = {
  args: {
    node: 'review',
    state: 'warn',
    isHead: true,
    session: {
      ...SESSION,
      review: {
        rounds: [{ round: 1, by: '@sam', verdict: 'changes', sha: 'a1b2c3d', open: 2 }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /Address 2/ }),
    ).toBeInTheDocument()
  },
}

/** S9's review side: round 1 archived (fixed and re-approved), round 2's approval now
 * stale under a newer push — same R3 mechanism as the lifecycle's own node. */
export const ReviewArchivedAndStale: Story = {
  args: {
    node: 'review',
    state: 'stale',
    isHead: false,
    session: {
      ...SESSION,
      review: {
        rounds: [
          { round: 1, by: '@sam', verdict: 'changes', sha: '9f1c2ab', archived: true, findings: 3 },
          { round: 2, by: '@sam', verdict: 'approved', sha: '9f1c2ab', stale: true },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/all fixed/)).toBeInTheDocument()
    await expect(canvas.getByText(/stale — re-requested on push/)).toBeInTheDocument()
  },
}

/** S8: GATE 2 — Merge arms and confirms the same two-step way Create PR does. */
export const MergeGate: Story = {
  args: { node: 'merge', state: 'gate', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: /Merge #42/ })
    await userEvent.click(button)
    await expect(canvas.getByRole('button', { name: /Confirm — merge/ })).toBeInTheDocument()
  },
}

/** S8b: delegated merge — armed at dispatch, the one revoke it carries (R6). */
export const MergeAuto: Story = {
  args: { node: 'merge', state: 'auto', isHead: true, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/auto-merge when CI and review/),
    ).toBeInTheDocument()
  },
}

/** R3: CI or the approval went stale under a newer push — merge locks rather than ships
 * a fact that no longer holds. */
export const MergeLocked: Story = {
  args: { node: 'merge', state: 'lock', isHead: false, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/locked/)).toBeInTheDocument()
  },
}

/** Waiting on CI and review — nothing to act on yet. */
export const MergeWaiting: Story = {
  args: { node: 'merge', state: 'wait', isHead: false, session: SESSION },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('waiting on CI and review')).toBeInTheDocument()
  },
}

/** R8: merged — the terminal summary, `--tone-landed` is asserted on the lifecycle itself; this
 * drawer carries the squash sha, who, when, and the next-step ghost control. */
export const TerminalMerged: Story = {
  args: { node: 'terminal', state: 'merged', session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('9f1c2ab')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /Next ticket from main/ })).toBeInTheDocument()
  },
}

/** R8: closed without merge — who, when, and why the branch was left behind. */
export const TerminalClosed: Story = {
  args: { node: 'terminal', state: 'closed', session: SESSION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The note rides the attribution line now — `by @sam · superseded by #47`.
    await expect(canvas.getByText(/superseded by #47/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /New session from main/ })).toBeInTheDocument()
  },
}
