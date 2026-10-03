import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  type HarnessSignInResolved,
  type HarnessSignInWaitReply,
  harnessSignInError,
} from '@/domains/harness-signin/contract/contract'
import type { Harness } from '@/harnesses/harness'
import { HarnessReadinessList } from './harness-readiness-row'
import { HarnessSignInCards } from './harness-sign-in-cards'

const signInStarted = fn()
const signInCanceled = fn()

function resolvedSignIn(
  harness: Harness,
  status: HarnessSignInResolved['status'],
): HarnessSignInResolved {
  return {
    version: 1,
    type: 'harness-sign-in.resolved',
    requestId: 'readiness-story-wait',
    harness,
    status,
    expiresAt: null,
    readiness: null,
  }
}

function mockSignIn({
  wait,
  cancel,
}: {
  wait: (harness: Harness) => HarnessSignInWaitReply | Promise<HarnessSignInWaitReply>
  cancel?: (harness: Harness) => void
}) {
  const before = window.argo
  signInStarted.mockClear()
  signInCanceled.mockClear()
  window.argo = {
    ...before,
    trpc: async (request) => {
      if (
        request.path !== 'harnessSignInStart' &&
        request.path !== 'harnessSignInWait' &&
        request.path !== 'harnessSignInCancel'
      )
        return before.trpc(request)
      const { harness } = request.input as { harness: Harness }
      switch (request.path) {
        case 'harnessSignInStart':
          signInStarted(harness)
          return {
            id: request.id,
            result: {
              data: {
                version: 1,
                type: 'harness-sign-in.started',
                requestId: 'readiness-story-start',
                harness,
                status: 'pending',
                expiresAt: Date.now() + 60_000,
              },
            },
          }
        case 'harnessSignInWait':
          return { id: request.id, result: { data: await wait(harness) } }
        case 'harnessSignInCancel':
          signInCanceled(harness)
          cancel?.(harness)
          return {
            id: request.id,
            result: {
              data: {
                version: 1,
                type: 'harness-sign-in.canceled',
                requestId: 'readiness-story-cancel',
                harness,
                status: 'canceled',
                expiresAt: null,
              },
            },
          }
        default:
          return before.trpc(request)
      }
    },
  }
  return () => {
    window.argo = before
  }
}

const meta = {
  title: 'Features/Harness Sign In/Readiness',
  component: HarnessReadinessList,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: { harnesses: [{ harness: 'claude', state: 'signed-out', detail: null }] },
} satisfies Meta<typeof HarnessReadinessList>

export default meta
type Story = StoryObj<typeof meta>

export const UnavailableRows: Story = {
  args: {
    harnesses: [
      { harness: 'claude', state: 'missing', detail: null },
      { harness: 'codex', state: 'policy-blocked', detail: 'Blocked by your organisation' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('listitem', { name: 'Claude, Not installed' })).toHaveTextContent(
      'Install the Claude CLI, then sign in.',
    )
    await expect(
      canvas.getByRole('listitem', { name: 'Codex, Blocked by policy' }),
    ).toHaveTextContent('Blocked by your organisation')
    await expect(canvas.queryByRole('button', { name: 'Sign in' })).toBeNull()
  },
}

export const NarrowCards: Story = {
  globals: { viewport: { value: 'compact', isRotated: false } },
  args: {
    harnesses: [
      { harness: 'claude', state: 'signed-out', detail: null },
      { harness: 'codex', state: 'missing', detail: null },
      {
        harness: 'claude-acp',
        state: 'policy-blocked',
        detail:
          'Your organisation requires a managed sign-in before this Harness can run a Session.',
      },
    ],
  },
  render: (args) => <HarnessSignInCards {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('list', { name: 'Harness sign-ins' })).toBeVisible()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3)
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    await expect(canvas.getByText('Not installed')).toBeVisible()
    await expect(
      canvas.getByText(
        'Your organisation requires a managed sign-in before this Harness can run a Session.',
      ),
    ).toBeVisible()
  },
}

export const KeyboardSignInAndCancel: Story = {
  beforeEach: () => {
    let finish: ((reply: HarnessSignInResolved) => void) | undefined
    const restore = mockSignIn({
      wait: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
      cancel: (harness) => finish?.(resolvedSignIn(harness, 'canceled')),
    })
    return () => {
      finish?.(resolvedSignIn('claude', 'canceled'))
      restore()
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const start = canvas.getByRole('button', { name: 'Sign in' })
    start.focus()
    await userEvent.keyboard('{Enter}')
    await expect(await canvas.findByRole('status')).toHaveTextContent('Waiting for Claude…')
    await expect(signInStarted).toHaveBeenCalledWith('claude')
    const cancel = canvas.getByRole('button', { name: 'Cancel' })
    cancel.focus()
    await userEvent.keyboard('{Enter}')
    await expect(signInCanceled).toHaveBeenCalledWith('claude')
    await expect(await canvas.findByText('Sign-in canceled.')).toHaveAttribute('role', 'status')
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  },
}

export const FailureRetry: Story = {
  render: (args) => <HarnessSignInCards {...args} />,
  beforeEach: () => {
    let attempts = 0
    let finish: ((reply: HarnessSignInResolved) => void) | undefined
    const restore = mockSignIn({
      wait: (harness) => {
        attempts += 1
        return attempts === 1
          ? resolvedSignIn(harness, 'failed')
          : new Promise((resolve) => {
              finish = resolve
            })
      },
    })
    return () => {
      finish?.(resolvedSignIn('claude', 'canceled'))
      restore()
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByText('The sign-in failed. Try again.')).toHaveAttribute(
      'role',
      'status',
    )
    const retry = canvas.getByRole('button', { name: 'Sign in' })
    retry.focus()
    await userEvent.keyboard('{Enter}')
    await expect(await canvas.findByText('Waiting for Claude…')).toHaveAttribute('role', 'status')
    await expect(signInStarted).toHaveBeenCalledTimes(2)
    await expect(signInStarted).toHaveBeenLastCalledWith('claude')
  },
}

export const ExpiredAttempt: Story = {
  beforeEach: () => mockSignIn({ wait: (harness) => resolvedSignIn(harness, 'expired') }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByText('The sign-in expired. Try again.')).toHaveAttribute(
      'role',
      'status',
    )
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  },
}

export const ContractFailure: Story = {
  beforeEach: () =>
    mockSignIn({ wait: () => harnessSignInError('connection-lost', 'readiness-story-error') }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The connection to Argo was lost.',
    )
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  },
}
