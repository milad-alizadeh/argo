import type { Meta, StoryObj } from '@storybook/react-vite'
import { Suspense, startTransition, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { expect, fn, waitFor, within } from 'storybook/test'
import type { SessionFeedRow } from '../../types'
import type { Settled } from '../document/use-settled-feed'
import { useRevealAnimation, useReveals } from './reveal'

const reply = {
  shape: 'prose',
  id: 'abandoned-reply',
  role: 'assistant',
  text: 'The settings panel now uses the shared spacing tokens.',
} satisfies SessionFeedRow
const neverSettles = new Promise<never>(() => {})

type Phase = 'history' | 'abandoned' | 'delivered'
let deliverPhase: (phase: Phase) => void
const abandonedRender = fn()

function RevealProbe({
  phase,
  onAbandonedRender,
}: {
  phase: Phase
  onAbandonedRender: () => void
}) {
  const settled: Settled = {
    reading: { sessionId: 'reveal-test', revision: phase },
    rows: phase === 'history' ? [] : [reply],
  }
  const reveals = useReveals(settled)
  const paragraph = useRef<HTMLParagraphElement>(null)
  useRevealAnimation(paragraph, reveals.get(reply.id))
  if (phase === 'abandoned') {
    onAbandonedRender()
    throw neverSettles
  }
  return phase === 'history' ? null : <p ref={paragraph}>{reply.text}</p>
}

function AbandonedRevealHarness() {
  const [phase, setPhase] = useState<Phase>('history')
  useEffect(() => {
    deliverPhase = setPhase
  }, [])
  return (
    <Suspense fallback={<p>Waiting for reply</p>}>
      <RevealProbe onAbandonedRender={abandonedRender} phase={phase} />
    </Suspense>
  )
}

const meta = {
  title: 'Features/Sessions/Feed/Reveal',
  component: AbandonedRevealHarness,
} satisfies Meta<typeof AbandonedRevealHarness>

export default meta
type Story = StoryObj<typeof AbandonedRevealHarness>

export const AbandonedRenderStillRevealsOnCommit: Story = {
  beforeEach: () => {
    abandonedRender.mockClear()
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    startTransition(() => deliverPhase('abandoned'))
    await waitFor(() => expect(abandonedRender).toHaveBeenCalled())
    expect(canvas.queryByText(reply.text)).toBeNull()
    // A render-time mutation consumes the reveal once its 250 ms preview expires.
    await new Promise((resolve) => setTimeout(resolve, 400))
    flushSync(() => deliverPhase('delivered'))
    const paragraph = canvas.getByText(reply.text)
    await expect(paragraph).toBeVisible()
    await expect(paragraph.getAnimations()).toHaveLength(1)
  },
}
