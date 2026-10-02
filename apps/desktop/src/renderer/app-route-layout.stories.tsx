import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createMemoryRouter, Navigate, RouterProvider } from 'react-router'
import { expect, userEvent, within } from 'storybook/test'
import type { HarnessReadinessState } from '@/domains/harness-signin/contract/contract'
import { SessionList } from '@/domains/sessions/renderer/session-list/session-list'
import type { Harness } from '@/harnesses/harness'
import { QUERY_KEYS } from '@/platform/renderer/lib/query-client'
import { AppRouteLayout } from './app-router'

function SectionScreen({ section }: { section: string }) {
  return <h1>{section}</h1>
}

function AppRouteLayoutStory({
  projectScoped = false,
  noHarnessEntry = false,
  launchReadiness,
}: {
  projectScoped?: boolean
  noHarnessEntry?: boolean
  // Opens at `/` with this readiness already read, as a launch whose readiness wins the race.
  launchReadiness?: ReturnType<typeof readinessListed>
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient()
    if (launchReadiness) client.setQueryData(QUERY_KEYS.harnessReadiness, launchReadiness.harnesses)
    return client
  })
  const initialEntry = (() => {
    if (launchReadiness) return '/'
    if (noHarnessEntry) return projectScoped ? '/projects/storybook-project/tickets' : '/tickets'
    return projectScoped ? '/projects/storybook-project/sessions' : '/sessions'
  })()
  const [router] = useState(() =>
    createMemoryRouter(
      [
        {
          element: <AppRouteLayout />,
          children: [
            { index: true, element: <Navigate replace to="/sessions" /> },
            {
              path: projectScoped ? '/projects/:projectId/sessions' : '/sessions',
              handle: { sidebar: <SessionList /> },
              // The sidebar reopens the last selected Session, so that path must resolve.
              children: [
                { index: true, element: <SectionScreen section="Sessions screen" /> },
                { path: ':sessionId', element: <SectionScreen section="Sessions screen" /> },
              ],
            },
            {
              path: projectScoped ? '/projects/:projectId/tickets' : '/tickets',
              element: <SectionScreen section="Tickets screen" />,
            },
          ],
        },
      ],
      {
        initialEntries: [initialEntry],
      },
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
  title: 'App/Routing/Route Layout',
  component: AppRouteLayoutStory,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppRouteLayoutStory>

export default meta
type Story = StoryObj<typeof AppRouteLayoutStory>

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

function mockHarnessTrpc(replies: Record<string, (input: unknown) => unknown | Promise<unknown>>) {
  const before = window.argo
  window.argo = {
    ...before,
    trpc: (async (request) => {
      const reply = replies[request.path]
      if (reply === undefined) return before.trpc(request)
      return { id: request.id, result: { data: await reply(request.input) } }
    }) as typeof window.argo.trpc,
  }
  return () => {
    window.argo = before
  }
}

function startedSignIn(input: unknown) {
  return {
    version: 1,
    type: 'harness-sign-in.started' as const,
    requestId: 'story-harness-sign-in-start',
    harness: (input as { harness: 'claude' | 'codex' }).harness,
    status: 'pending' as const,
    expiresAt: Date.now() + 60_000,
  }
}

// A Project with no ready Harness has nothing to run a Session on, so the roster this Project
// would otherwise show is replaced by a picker over every supported Harness and how to sign in
// to whichever one is selected (#2579).
export const NoHarnessReady: Story = {
  args: { noHarnessEntry: true },
  beforeEach: () =>
    mockHarnessTrpc({
      harnessReadinessList: () =>
        readinessListed([
          { harness: 'claude', state: 'signed-out' },
          { harness: 'codex', state: 'missing' },
        ]),
    }),
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
  args: { noHarnessEntry: true },
  beforeEach: () =>
    mockHarnessTrpc({
      harnessReadinessList: () =>
        readinessListed([
          { harness: 'claude', state: 'policy-blocked' },
          { harness: 'codex', state: 'missing' },
        ]),
    }),
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
  args: { noHarnessEntry: true },
  beforeEach: () =>
    mockHarnessTrpc({
      harnessReadinessList: () => readinessListed([{ harness: 'claude', state: 'signed-out' }]),
      harnessSignInStart: (input) => startedSignIn(input),
      // Never settles: the story only exercises the pending state, not what follows it.
      harnessSignInWait: () => new Promise(() => {}),
    }),
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
  args: { noHarnessEntry: true },
  beforeEach: () =>
    mockHarnessTrpc({
      harnessReadinessList: () => readinessListed([{ harness: 'claude', state: 'signed-out' }]),
      harnessSignInStart: (input) => startedSignIn(input),
      harnessSignInWait: (input) => ({
        version: 1,
        type: 'harness-sign-in.resolved' as const,
        requestId: 'story-harness-sign-in-wait',
        harness: (input as { harness: 'claude' }).harness,
        status: 'failed' as const,
        expiresAt: null,
        readiness: null,
      }),
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Sign in to a Harness')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByText('The sign-in failed. Try again.')).toBeVisible()
  },
}

const noHarnessInstalled = readinessListed([
  { harness: 'claude', state: 'missing' },
  { harness: 'codex', state: 'missing' },
])

// A launch whose readiness is read before its redirect lands still reaches Sessions: a gate on
// `/` would stop the redirect there (#2996).
export const LaunchWithNoHarnessReadyRedirects: Story = {
  args: { launchReadiness: noHarnessInstalled },
  beforeEach: () => mockHarnessTrpc({ harnessReadinessList: () => noHarnessInstalled }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Sessions screen' })).toBeVisible()
    await expect(canvas.queryByText('Sign in to a Harness')).toBeNull()
  },
}

// A rail switch draws the chosen section's screen, in both directions (#2836).
export const SectionSwitchDrawsTheChosenScreen: Story = {
  args: { projectScoped: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('heading', { name: 'Sessions screen' })
    await userEvent.click(canvas.getByRole('button', { name: 'Tickets' }))
    await expect(await canvas.findByRole('heading', { name: 'Tickets screen' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(canvas.queryByRole('heading', { name: 'Sessions screen' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Sessions' }))
    await expect(await canvas.findByRole('heading', { name: 'Sessions screen' })).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: 'Tickets screen' })).toBeNull()
  },
}
