import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, userEvent, within } from 'storybook/test'
import type { Harness, HarnessReadinessState } from '@/domains/harness-signin/contract/contract'
import { SessionsSidebar } from '@/domains/sessions/renderer/session-list/sidebar/sessions-sidebar'
import { CockpitRouteLayout } from './cockpit-router'

function CockpitRouteLayoutStory() {
  const [queryClient] = useState(() => new QueryClient())
  const [router] = useState(() =>
    createMemoryRouter(
      [
        {
          element: <CockpitRouteLayout />,
          children: [
            {
              path: '/sessions',
              handle: { sidebar: <SessionsSidebar /> },
              // The sidebar reopens the last selected Session, so that path must resolve.
              children: [
                { index: true, element: null },
                { path: ':sessionId', element: null },
              ],
            },
          ],
        },
      ],
      { initialEntries: ['/sessions'] },
    ),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-dvh">
        <RouterProvider router={router} />
      </div>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Cockpit/Route Layout',
  component: CockpitRouteLayoutStory,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CockpitRouteLayoutStory>

export default meta
type Story = StoryObj<typeof CockpitRouteLayoutStory>

function readinessListed(harnesses: Array<{ harness: Harness; state: HarnessReadinessState }>) {
  return {
    version: 1 as const,
    type: 'harness-readiness.listed' as const,
    requestId: 'story-harness-readiness',
    harnesses: harnesses.map(({ harness, state }) => ({
      harness,
      state,
      detail: state === 'policy-blocked' ? 'Blocked by your organisation' : null,
    })),
  }
}

// A Project with no ready Harness has nothing to run a Session on, so the roster this Project
// would otherwise show is replaced by a picker over every supported Harness and how to sign in
// to whichever one is selected (#2579).
export const NoHarnessReady: Story = {
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      listHarnessReadiness: () =>
        Promise.resolve(
          readinessListed([
            { harness: 'claude', state: 'signed-out' },
            { harness: 'codex', state: 'missing' },
          ]),
        ),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Sign in to a Harness')).toBeVisible()
    await expect(canvas.queryByRole('complementary', { name: 'Sessions sidebar' })).toBeNull()
    // Both Harnesses show at once, so there is nothing to pick before acting on either.
    const group = within(canvas.getByRole('list', { name: 'Harness sign-ins' }))
    await expect(group.getByText('Claude')).toBeVisible()
    await expect(group.getByText('Not signed in')).toBeVisible()
    await expect(group.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(group.getByText('Codex')).toBeVisible()
    await expect(group.getByText('Not installed')).toBeVisible()
  },
}

// A policy-blocked Harness names the reason instead of offering a CTA there is nothing to sign
// into (#2579).
export const NoHarnessReadyPolicyBlocked: Story = {
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      listHarnessReadiness: () =>
        Promise.resolve(
          readinessListed([
            { harness: 'claude', state: 'policy-blocked' },
            { harness: 'codex', state: 'missing' },
          ]),
        ),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Sign in to a Harness')
    const group = within(canvas.getByRole('list', { name: 'Harness sign-ins' }))
    await expect(group.getByText('Blocked by your organisation')).toBeVisible()
    await expect(group.getByText('Not installed')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Sign in' })).toBeNull()
  },
}

// Starting a sign-in shows its own wait state with a way out, since the attempt can outlive the
// person's patience (#2579).
export const NoHarnessReadySigningIn: Story = {
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      listHarnessReadiness: () =>
        Promise.resolve(readinessListed([{ harness: 'claude', state: 'signed-out' }])),
      startHarnessSignIn: ({ harness }) =>
        Promise.resolve({
          version: 1,
          type: 'harness-sign-in.started',
          requestId: 'story-harness-sign-in-start',
          harness,
          status: 'pending',
          expiresAt: Date.now() + 60_000,
        }),
      // Never settles: the story only exercises the pending state, not what follows it.
      waitHarnessSignIn: () => new Promise(() => {}),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Sign in to a Harness')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByText('Waiting for Claude…')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  },
}

// A failed attempt says so in place, so the person retries from the same panel rather than
// losing their place (#2579).
export const NoHarnessReadySignInFailed: Story = {
  beforeEach: () => {
    const before = window.argo
    window.argo = {
      ...before,
      listHarnessReadiness: () =>
        Promise.resolve(readinessListed([{ harness: 'claude', state: 'signed-out' }])),
      startHarnessSignIn: ({ harness }) =>
        Promise.resolve({
          version: 1,
          type: 'harness-sign-in.started',
          requestId: 'story-harness-sign-in-start',
          harness,
          status: 'pending',
          expiresAt: Date.now() + 60_000,
        }),
      waitHarnessSignIn: ({ harness }) =>
        Promise.resolve({
          version: 1,
          type: 'harness-sign-in.resolved',
          requestId: 'story-harness-sign-in-wait',
          harness,
          status: 'failed',
          expiresAt: null,
          readiness: null,
        }),
    }
    return () => {
      window.argo = before
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Sign in to a Harness')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByText('The sign-in failed. Try again.')).toBeVisible()
  },
}
