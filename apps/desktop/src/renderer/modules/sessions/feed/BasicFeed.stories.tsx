import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import type { SessionError, SessionFeed } from '../types'

import { BasicFeed } from './BasicFeed'
import { RICH_MARKDOWN } from './content/feedSamples'

const feed = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'storybook-feed',
  sessionId: 'prose',
  chainId: 'prose',
  revision: 'one',
  rows: [{ shape: 'prose', id: 'prose-1', role: 'assistant', text: 'The matching Session Feed.' }],
} satisfies SessionFeed

const readFailure = {
  version: 1,
  type: 'session.error',
  requestId: 'storybook-feed-error',
  code: 'internal-error',
  message: 'Argo could not read these Sessions.',
} satisfies SessionError

const meta: Meta<typeof BasicFeed> = {
  title: 'Sessions/Feed',
  component: BasicFeed,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
  ],
  args: {
    activeEvidenceId: null,
    feed,
    failure: null,
    isRunning: false,
    onOpenEvidence: () => {},
    selectedSessionId: 'prose',
  },
}

export default meta
type Story = StoryObj<typeof BasicFeed>

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByLabelText('Session history')).toHaveAttribute(
        'data-session',
        'prose',
      ),
    )
  },
}
export const Loading: Story = {
  args: { feed: null, failure: null, selectedSessionId: 'prose' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Loading' })).toHaveAttribute(
      'data-slot',
      'spinner',
    )
  },
}
export const Empty: Story = {
  args: { feed: { ...feed, rows: [] }, failure: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('No messages')).toBeInTheDocument())
    await expect(canvas.getByText('No messages').closest('[data-slot="empty"]')).not.toBeNull()
    await expect(canvas.getByText('No messages').closest('[data-slot="empty"]')).toHaveTextContent(
      'This Session has no messages to show.',
    )
  },
}
export const Unselected: Story = {
  args: { feed: null, failure: null, selectedSessionId: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Session selected')).toBeInTheDocument()
    await expect(
      canvas.getByText('No Session selected').closest('[data-slot="empty"]'),
    ).not.toBeNull()
  },
}
export const Failure: Story = {
  args: { feed: null, failure: readFailure },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveAttribute('data-slot', 'alert')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Unable to load Session')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Argo could not read these Sessions.')
  },
}

const richFeed = {
  ...feed,
  sessionId: 'rich',
  chainId: 'rich',
  revision: 'rich-one',
  rows: [
    { shape: 'prose', id: 'rich-prompt', role: 'user', text: 'Show me the **composer** check.' },
    { shape: 'prose', id: 'rich-answer', role: 'assistant', text: RICH_MARKDOWN },
  ],
} satisfies SessionFeed

function drawnRows(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-feed-row]')].filter(
    (row) => row.closest('.feed__measured') === null,
  )
}

// Each drawn row keeps the height its measured copy was given, after the highlighter and the
// images have finished (ADR-0035). User prose stays the text it was typed as.
export const FormattedProse: Story = {
  args: { feed: richFeed, selectedSessionId: 'rich' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
    const [prompt, answer] = drawnRows(canvasElement)
    await expect(prompt).toHaveTextContent('Show me the **composer** check.')
    await expect(prompt?.querySelector('[data-slot="bubble"]')).toHaveAttribute(
      'data-variant',
      'muted',
    )
    await waitFor(() =>
      expect(answer?.querySelector('code[data-highlighted="true"]')).not.toBeNull(),
    )
    await waitFor(() => expect(answer?.querySelector('button[data-state="loaded"]')).not.toBeNull())
    await waitFor(() =>
      expect(within(answer as HTMLElement).getByText('Image unavailable')).toBeVisible(),
    )
    for (const row of drawnRows(canvasElement)) {
      const measured = canvasElement.querySelector(
        `.feed__measured [data-feed-row="${row.dataset.feedRow}"]`,
      )
      await expect(Number.parseFloat(row.style.height)).toBe(
        measured?.getBoundingClientRect().height,
      )
      await expect(row.scrollHeight).toBe(row.clientHeight)
    }
  },
}

const taskNotificationFeed = {
  ...feed,
  chainId: 'task-notification',
  revision: 'task-notification-one',
  sessionId: 'task-notification',
  rows: [
    {
      shape: 'prose' as const,
      id: 'task-notification-prompt',
      role: 'user' as const,
      text: 'Kick off the consolidation pass.',
    },
    {
      shape: 'command-output' as const,
      id: 'task-notification-summary',
      text: 'Agent "Consolidate stories" finished',
    },
  ],
} satisfies SessionFeed

const skillMentionFeed = {
  ...feed,
  sessionId: 'skill-mention',
  chainId: 'skill-mention',
  revision: 'skill-mention-one',
  rows: [
    {
      shape: 'prose' as const,
      id: 'skill-mention-prompt',
      role: 'user' as const,
      text: '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)',
    },
  ],
} satisfies SessionFeed

// A background task's delivery shows only its summary line, not the raw <task-notification>
// envelope or its embedded JSON result (#2054).
export const TaskNotification: Story = {
  args: { feed: taskNotificationFeed, selectedSessionId: 'task-notification' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() =>
      expect(canvas.getByText('Agent "Consolidate stories" finished')).toBeInTheDocument(),
    )
    await expect(canvas.queryByText(/task-notification/)).toBeNull()
    await expect(canvas.queryByText(/"files"/)).toBeNull()
  },
}

// A prompt that opens with a skill mention and a link draws a badge and a clean link, not the
// raw markdown-link brackets (#2049).
export const PromptWithSkillMentionAndLink: Story = {
  args: { feed: skillMentionFeed, selectedSessionId: 'skill-mention' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(1))
    const [prompt] = drawnRows(canvasElement)
    await expect(prompt).toHaveTextContent('Implement')
    await expect(prompt).not.toHaveTextContent('[$implement]')
    await expect(
      canvas.getByRole('link', { name: 'https://github.com/milad-alizadeh/argo/issues/1944' }),
    ).toBeVisible()
  },
}

const toolFeed = {
  ...feed,
  chainId: 'tools',
  revision: 'tools-one',
  sessionId: 'tools',
  rows: [
    {
      shape: 'tool-group' as const,
      id: 'tool-group:one:two',
      label: 'Ran a command, edited a file',
      calls: [
        {
          shape: 'tool' as const,
          id: 'one',
          kind: 'command' as const,
          label: 'Ran a command',
          detail: null,
          status: 'succeeded' as const,
          evidence: { kind: 'output' as const, title: 'bun test composer', source: '3 pass' },
          text: 'bun test composer',
        },
        {
          shape: 'tool' as const,
          id: 'two',
          kind: 'edited' as const,
          label: 'Edited Composer.tsx',
          detail: '+2 −1',
          status: 'failed' as const,
          evidence: { kind: 'diff' as const, title: 'Composer.tsx', source: '-old\n+new' },
          text: null,
        },
      ],
    },
  ],
} satisfies SessionFeed

export const GroupedToolCalls: Story = {
  args: { feed: toolFeed, selectedSessionId: 'tools' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('button', { name: 'Ran a command, edited a file' })
    await userEvent.click(group)
    const commandText = await canvas.findByText((_content, node) => {
      const isMatch = node?.textContent === 'bun test composer'
      const descendantHasMatch = Array.from(node?.querySelectorAll('*') ?? []).some(
        (descendant) => descendant.textContent === 'bun test composer',
      )
      const isMeasurementClone = node?.closest('[aria-hidden="true"]') !== null
      return isMatch && !descendantHasMatch && !isMeasurementClone
    })
    const call = await canvas.findByRole('button', { name: /Edited Composer.tsx/ })
    await expect(group).toHaveClass('type-body')
    await expect(commandText).toBeVisible()
    await expect(call).toHaveClass('type-body')
  },
}

const toolLagFeed = {
  ...toolFeed,
  chainId: 'tools-lag',
  revision: 'tools-lag-one',
  sessionId: 'tools-lag',
  rows: toolFeed.rows.map((row) => ({ ...row, id: 'tool-group:lag' })),
} satisfies SessionFeed

// A group's own drawn height must always match its panel's real size, on the very tick a toggle
// settles: a frame where the panel already shows its open content while the row still carries its
// old, smaller pixel height is the overlapping-render artifact #2104 reproduces. Base UI holds a
// closing panel at its expanded size for the length of its own close animation, so the row's
// height rightly does too, and only drops once that animation actually finishes.
export const ToolGroupTogglesWithNoLag: Story = {
  args: { feed: toolLagFeed, selectedSessionId: 'tools-lag' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const groupId = 'tool-group:lag'
    const row = () => drawnRow(canvasElement, groupId) as HTMLElement
    const measuredHeight = () =>
      canvasElement
        .querySelector(`.feed__measured [data-feed-row="${groupId}"]`)
        ?.getBoundingClientRect().height

    await waitFor(() => expect(Number.parseFloat(row()?.style.height)).toBe(measuredHeight()))
    const collapsedHeight = Number.parseFloat(row().style.height)

    const group = await canvas.findByRole('button', { name: 'Ran a command, edited a file' })
    await userEvent.click(group)
    // Open is instant: the panel's own final size is known before its fade-and-slide plays.
    await expect(Number.parseFloat(row().style.height)).toBe(measuredHeight())
    await expect(Number.parseFloat(row().style.height)).toBeGreaterThan(collapsedHeight)
    const openHeight = Number.parseFloat(row().style.height)

    await userEvent.click(group)
    // Close never clips: the row stays at the open height while the panel visibly slides away.
    // The hidden measured copy is not a witness here — `content-visibility: hidden` skips running
    // its close animation entirely, so it jumps straight to its final collapsed size while the
    // real, visible panel is still genuinely animating; only the drawn row's own height matters.
    await expect(Number.parseFloat(row().style.height)).toBe(openHeight)
    // …and settles to the collapsed height once that animation actually finishes, with no
    // further pass required to notice. A longer timeout, as elsewhere in this file
    // (`StreamingReply`): the assertion waits on a real CSS animation plus a browser-frame
    // detection fallback, which a loaded CI runner can take longer than the default to clear.
    await waitFor(() => expect(Number.parseFloat(row().style.height)).toBe(collapsedHeight), {
      timeout: 3000,
    })
    await expect(Number.parseFloat(row().style.height)).toBe(measuredHeight())
  },
}

const toolUpdateFeed = {
  ...toolFeed,
  chainId: 'tools-update',
  revision: 'tools-update-one',
  sessionId: 'tools-update',
  rows: toolFeed.rows.map((row) => ({ ...row, id: 'tool-group:update' })),
} satisfies SessionFeed

const toolUpdateReply = {
  ...toolUpdateFeed,
  revision: 'tools-update-two',
  rows: [
    ...toolUpdateFeed.rows,
    { shape: 'prose', id: 'tools-update-reply', role: 'assistant', text: 'Ready for review.' },
  ],
} satisfies SessionFeed

function ToolGroupDuringFeedUpdate() {
  const [current, setCurrent] = useState<SessionFeed>(toolUpdateFeed)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(toolUpdateReply)}>
        Receive reply
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={current}
          failure={null}
          isRunning={false}
          selectedSessionId="tools-update"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          onRetryFeed={() => {}}
        />
      </div>
    </div>
  )
}

// The riskier of the two repro paths #2104 names: a real content update lands (a new reply row,
// its own full settle pass behind the warm-up) the same tick a reader expands an unrelated group.
// The group's own toggle carries no content change, so it must still read instant off the
// relayout path rather than being swept into the reply's pass and left showing a stale height
// until that pass completes.
export const ToolGroupExpandDuringFeedUpdate: Story = {
  render: () => <ToolGroupDuringFeedUpdate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const groupId = 'tool-group:update'
    const row = () => drawnRow(canvasElement, groupId) as HTMLElement
    const measuredHeight = () =>
      canvasElement
        .querySelector(`.feed__measured [data-feed-row="${groupId}"]`)
        ?.getBoundingClientRect().height

    await waitFor(() => expect(Number.parseFloat(row()?.style.height)).toBe(measuredHeight()))
    const collapsedHeight = Number.parseFloat(row().style.height)

    await userEvent.click(canvas.getByRole('button', { name: 'Receive reply' }))
    const group = await canvas.findByRole('button', { name: 'Ran a command, edited a file' })
    await userEvent.click(group)

    await waitFor(() => expect(drawnRow(canvasElement, 'tools-update-reply')).toBeDefined())
    await expect(Number.parseFloat(row().style.height)).toBe(measuredHeight())
    await expect(Number.parseFloat(row().style.height)).toBeGreaterThan(collapsedHeight)
    await expect(
      drawnRows(canvasElement).filter((drawn) => drawn.dataset.feedRow === groupId),
    ).toHaveLength(1)
  },
}

const streamingFeed = {
  ...feed,
  sessionId: 'streaming',
  chainId: 'streaming',
  revision: 'streaming-one',
  rows: [
    { shape: 'prose', id: 'streaming-prompt', role: 'user', text: 'Summarise the check.' },
    { shape: 'prose', id: 'streaming-first', role: 'assistant', text: 'The check ran.' },
  ],
} satisfies SessionFeed

const streamingReply = {
  ...streamingFeed,
  revision: 'streaming-two',
  rows: [
    ...streamingFeed.rows,
    { shape: 'prose', id: 'streaming-second', role: 'assistant', text: RICH_MARKDOWN },
  ],
} satisfies SessionFeed

function StreamingFeed() {
  const [current, setCurrent] = useState<SessionFeed>(streamingFeed)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setCurrent(streamingReply)}>
        Receive reply
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={current}
          failure={null}
          isRunning={false}
          selectedSessionId="streaming"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
        />
      </div>
    </div>
  )
}

function drawnRow(canvasElement: HTMLElement, id: string) {
  return drawnRows(canvasElement).find((row) => row.dataset.feedRow === id)
}

// History shows at once; a reply that arrives while the Feed is open is uncovered inside the
// height it was measured at, and ends with no mask left on the row.
export const StreamingReply: Story = {
  render: () => <StreamingFeed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
    for (const row of drawnRows(canvasElement)) {
      await expect(row).not.toHaveAttribute('data-revealing')
    }

    await userEvent.click(canvas.getByRole('button', { name: 'Receive reply' }))
    await waitFor(() => expect(drawnRow(canvasElement, 'streaming-second')).toBeDefined())
    const reply = drawnRow(canvasElement, 'streaming-second') as HTMLElement
    await expect(reply).toHaveAttribute('data-revealing', 'true')
    await expect(reply.getAnimations()).toHaveLength(1)
    await expect(drawnRow(canvasElement, 'streaming-first')).not.toHaveAttribute('data-revealing')
    const measured = canvasElement.querySelector(
      '.feed__measured [data-feed-row="streaming-second"]',
    )
    await expect(Number.parseFloat(reply.style.height)).toBe(
      measured?.getBoundingClientRect().height,
    )
    await waitFor(() => expect(reply.getAnimations()).toHaveLength(0), { timeout: 3000 })
    await expect(getComputedStyle(reply).maskImage).toBe('none')
  },
}

// The play function cannot set the system's motion preference, so it answers the query itself.
function preferReducedMotion(): () => void {
  const system = window.matchMedia
  window.matchMedia = (query) =>
    query === '(prefers-reduced-motion: reduce)'
      ? ({ matches: true, media: query } as MediaQueryList)
      : system.call(window, query)
  return () => {
    window.matchMedia = system
  }
}

const stalledFeed = {
  ...feed,
  sessionId: 'stalled',
  chainId: 'stalled',
  revision: 'stalled-one',
  rows: [],
} satisfies SessionFeed

// A fixture whose Feed never settles: `rows` stays empty and `isRunning` stays true for the
// whole story, so nothing ever satisfies `feedContent`'s running condition (#2102). `stallTimeoutMs`
// stands in for the production bound so the story does not wait on the real one.
function StalledFeedHarness() {
  const [otherClicks, setOtherClicks] = useState(0)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setOtherClicks((count) => count + 1)}>
        Other window control ({otherClicks})
      </button>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={stalledFeed}
          failure={null}
          isRunning
          posture="external"
          selectedSessionId="stalled"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => {}}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          stallTimeoutMs={50}
        />
      </div>
    </div>
  )
}

// Past the stall bound, the reader sees a retry action instead of an indefinite spinner, and
// nothing else in the window stops responding while it shows (#2102).
export const Stalled: Story = {
  render: () => <StalledFeedHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Could not load this Session')).toBeInTheDocument())
    await expect(canvas.getByText(/This Session is external/)).toBeInTheDocument()
    const retry = canvas.getByRole('button', { name: 'Retry' })

    const otherControl = canvas.getByRole('button', { name: /Other window control/ })
    await userEvent.click(otherControl)
    await expect(
      canvas.getByRole('button', { name: 'Other window control (1)' }),
    ).toBeInTheDocument()

    await userEvent.click(retry)
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
  },
}

// A Session whose read never answers at all (no SessionFeed ever arrives, #2111's repro):
// `feed` stays null instead of arriving with empty `rows`. Retry calls `onRetryFeed`, the
// reader's hook into a fresh IPC attempt, not just the local bound.
function NeverArrivesHarness() {
  const [retries, setRetries] = useState(0)
  const [otherClicks, setOtherClicks] = useState(0)
  return (
    <div className="flex h-dvh flex-col">
      <button type="button" onClick={() => setOtherClicks((count) => count + 1)}>
        Other window control ({otherClicks})
      </button>
      <span>Retries: {retries}</span>
      <div className="min-h-0 flex-1">
        <BasicFeed
          activeEvidenceId={null}
          feed={null}
          failure={null}
          isRunning={false}
          posture="external"
          selectedSessionId="never-arrives"
          onOpenEvidence={() => {}}
          onOpenSession={() => {}}
          onRetryFeed={() => setRetries((count) => count + 1)}
          onAnswerQuestion={() => {}}
          answeringQuestionId={null}
          questionFailure={() => null}
          stallTimeoutMs={50}
        />
      </div>
    </div>
  )
}

// The window stays live while the read is stuck (nothing else stops responding), and the reader
// gets a retry that reaches the actual read, not a reload (#2102).
export const NeverArrives: Story = {
  render: () => <NeverArrivesHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Could not load this Session')).toBeInTheDocument())
    await expect(canvas.getByText(/This Session is external/)).toBeInTheDocument()

    const otherControl = canvas.getByRole('button', { name: /Other window control/ })
    await userEvent.click(otherControl)
    await expect(
      canvas.getByRole('button', { name: 'Other window control (1)' }),
    ).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(canvas.getByText('Retries: 1')).toBeInTheDocument())
  },
}

export const StreamingReplyReducedMotion: Story = {
  render: () => <StreamingFeed />,
  play: async ({ canvasElement }) => {
    const restore = preferReducedMotion()
    try {
      await waitFor(() => expect(drawnRows(canvasElement)).toHaveLength(2))
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Receive reply' }))
      await waitFor(() => expect(drawnRow(canvasElement, 'streaming-second')).toBeDefined())
      const reply = drawnRow(canvasElement, 'streaming-second') as HTMLElement
      await expect(reply.getAnimations()).toHaveLength(0)
      await expect(getComputedStyle(reply).maskImage).toBe('none')
    } finally {
      restore()
    }
  },
}
