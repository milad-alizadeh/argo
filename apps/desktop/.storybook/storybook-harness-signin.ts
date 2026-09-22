import type { HarnessSignInClient } from '../src/domains/harness-signin/preload/client'

// Ready by default so a story about anything else never lands on the empty-Harness screen; a
// story about that screen overrides `listHarnessReadiness` the way `NoProject` overrides
// `listProjects` (#2579).
export const storybookHarnessSignInBridge: HarnessSignInClient = {
  listHarnessReadiness: () =>
    Promise.resolve({
      version: 1,
      type: 'harness-readiness.listed',
      requestId: 'storybook-harness-readiness',
      harnesses: [
        { harness: 'claude', state: 'ready', detail: null },
        { harness: 'codex', state: 'ready', detail: null },
      ],
    }),
  startHarnessSignIn: ({ harness }) =>
    Promise.resolve({
      version: 1,
      type: 'harness-sign-in.started',
      requestId: 'storybook-harness-sign-in-start',
      harness,
      status: 'pending',
      expiresAt: Date.now() + 60_000,
    }),
  waitHarnessSignIn: ({ harness }) =>
    Promise.resolve({
      version: 1,
      type: 'harness-sign-in.resolved',
      requestId: 'storybook-harness-sign-in-wait',
      harness,
      status: 'ready',
      expiresAt: null,
      readiness: { harness, state: 'ready', detail: null },
    }),
  cancelHarnessSignIn: ({ harness }) =>
    Promise.resolve({
      version: 1,
      type: 'harness-sign-in.canceled',
      requestId: 'storybook-harness-sign-in-cancel',
      harness,
      status: 'canceled',
      expiresAt: null,
    }),
}
