import type { LifecycleModel } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import type { AllFilesDiffFile } from './AllFilesDiff'
import type { DeliveryCommitGroup } from './Delivery'
import { Delivery } from './Delivery'
import type { NodeDrawerSession } from './NodeDrawer'

const IN_REVIEW: LifecycleModel = {
  nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'now', merge: 'wait' },
  head: 'review',
  terminal: null,
}

const PR = { num: 42, ghUrl: 'https://github.com/milad-alizadeh/argo/pull/42' }

const SESSION: NodeDrawerSession = {
  commits: { dirty: 3, headSha: null, unpushed: 0, draftMessage: 'feat: rotate auth tokens' },
  pr: { headSha: 'a1b2c3d' },
  ci: {
    sha: 'a1b2c3d',
    status: 'passed',
    aggregate: '3 passed',
    runs: [{ name: 'test', status: 'passed', duration: '48s' }],
  },
  review: { rounds: [] },
  merge: { prNum: 42, headSha: 'a1b2c3d' },
  merged: { sha: '9f1c2ab', how: 'squash', by: 'milad', when: '2h ago' },
  closed: { by: 'milad', when: '1d ago', note: 'superseded by #47' },
}

const ALL_FILES: AllFilesDiffFile[] = [
  {
    kind: 'M',
    path: 'src/auth/rotateToken.ts',
    adds: 12,
    dels: 4,
    hunk: [{ side: 'add', text: '+ assertAudience(claim)' }],
    findings: [],
    commit: '41ce2f0',
  },
  {
    kind: 'A',
    path: 'src/auth/assertAudience.ts',
    adds: 8,
    dels: 0,
    hunk: [{ side: 'add', text: '+ export function assertAudience() {}' }],
    findings: [],
    commit: null,
  },
]

const COMMIT_GROUPS: DeliveryCommitGroup[] = [
  {
    commit: { sha: '41ce2f0', message: 'Assert audience on legacy tokens' },
    files: [
      {
        kind: 'M',
        path: 'src/auth/rotateToken.ts',
        adds: 12,
        dels: 4,
        hunk: [{ side: 'add', text: '+ assertAudience(claim)' }],
        findings: [],
      },
    ],
  },
  {
    commit: null,
    files: [
      {
        kind: 'A',
        path: 'src/auth/assertAudience.ts',
        adds: 8,
        dels: 0,
        hunk: [{ side: 'add', text: '+ export function assertAudience() {}' }],
        findings: [],
      },
    ],
  },
]

const meta = {
  title: 'Delivery/Delivery',
  component: Delivery,
  args: {
    lifecycle: IN_REVIEW,
    openNode: 'pr',
    pr: PR,
    drawerSession: SESSION,
    tab: 'changes',
    changesView: 'all',
    reviewOutstanding: 0,
    artifactsCount: 4,
    allFiles: ALL_FILES,
    commitGroups: COMMIT_GROUPS,
    onSelectTab: fn(),
    onChangeChangesView: fn(),
    onAdvanceFindingState: fn(),
  },
  argTypes: {
    lifecycle: { control: false },
    openNode: { control: false },
    pr: { control: false },
    drawerSession: { control: false },
    allFiles: { control: false },
    commitGroups: { control: false },
  },
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Delivery>

export default meta
type Story = StoryObj<typeof meta>

/** The everyday panel: lifecycle strip with the PR anchor, the inspected PR node's drawer, and
 * the Changes tab's flat diff — the whole spine assembled. */
export const InReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('PR #42')).toBeInTheDocument()
    // The open PR node's drawer body.
    await expect(canvas.getByText(/live on the strip anchor/)).toBeInTheDocument()
    // Changes count is driven by the file list, and the flat diff is showing.
    await expect(canvas.getByRole('tab', { name: /Changes · 2/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(canvas.getByText('vs merge-base')).toBeInTheDocument()
    await expect(canvas.getByText('src/auth/rotateToken.ts')).toBeInTheDocument()
  },
}

/** By commit — the Changes tab swaps the flat diff for per-commit groups, WIP group included. */
export const ByCommit: Story = {
  args: { changesView: 'commits' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Assert audience on legacy tokens')).toBeInTheDocument()
    await expect(canvas.getByText('Uncommitted changes')).toBeInTheDocument()
    await expect(canvas.queryByText('vs merge-base')).not.toBeInTheDocument()
  },
}

/** The Review tab — its verdict hero and findings list land with the SessionScreen, so the
 * panel shows an honest empty state, not a broken tab. */
export const ReviewTab: Story = {
  args: { tab: 'review' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Review lands with the session screen.')).toBeInTheDocument()
    await expect(canvas.queryByText('vs merge-base')).not.toBeInTheDocument()
  },
}

/** The Artifacts tab — same honest placeholder until the SessionScreen brings the list. */
export const ArtifactsTab: Story = {
  args: { tab: 'artifacts' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Artifacts land with the session screen.'),
    ).toBeInTheDocument()
  },
}

/** R8: merged — the strip collapses to the terminal card and the drawer becomes the merge
 * summary, no per-node pointer. */
export const Merged: Story = {
  args: {
    lifecycle: { nodes: null, head: null, terminal: 'merged' },
    openNode: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The strip collapsed to the terminal card — no per-node labels left.
    await expect(canvas.queryByText('Commits')).not.toBeInTheDocument()
    // The terminal drawer is the merge summary, not a per-node body.
    await expect(canvas.getByText('9f1c2ab')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /Next ticket from main/ })).toBeInTheDocument()
  },
}
