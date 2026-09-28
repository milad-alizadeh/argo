import type { Meta, StoryObj } from '@storybook/react-vite'
import { Suspense, startTransition, useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { SessionFeedRow } from '../../types'
import type { Settled } from '../document/use-settled-feed'
import { useReveals } from './reveal'

const reply: SessionFeedRow = {
  shape: 'prose',
  id: 'abandoned-reply',
  role: 'assistant',
  text: 'This reply must reveal when its render commits.',
}
const neverSettles = new Promise<never>(() => {})

type Phase = 'history' | 'abandoned' | 'delivered'

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
  if (phase === 'abandoned') {
    onAbandonedRender()
    throw neverSettles
  }
  return <output data-testid="reveal-result">{reveals.has(reply.id) ? 'revealing' : phase}</output>
}

function AbandonedRevealHarness() {
  const [phase, setPhase] = useState<Phase>('history')
  const attempted = useRef<HTMLOutputElement>(null)
  return (
    <div>
      <button type="button" onClick={() => startTransition(() => setPhase('abandoned'))}>
        Attempt reply render
      </button>
      <button type="button" onClick={() => setPhase('delivered')}>
        Deliver reply
      </button>
      <output data-attempted="false" data-testid="render-attempt" ref={attempted} />
      <Suspense fallback={<p>Waiting for reply</p>}>
        <RevealProbe
          onAbandonedRender={() => attempted.current?.setAttribute('data-attempted', 'true')}
          phase={phase}
        />
      </Suspense>
    </div>
  )
}

const meta = {
  title: 'Sessions/Feed/Reveal',
  component: AbandonedRevealHarness,
} satisfies Meta<typeof AbandonedRevealHarness>

export default meta
type Story = StoryObj<typeof AbandonedRevealHarness>

export const AbandonedRenderStillRevealsOnCommit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByTestId('reveal-result')).toHaveTextContent('history')
    await userEvent.click(canvas.getByRole('button', { name: 'Attempt reply render' }))
    await waitFor(() =>
      expect(canvas.getByTestId('render-attempt')).toHaveAttribute('data-attempted', 'true'),
    )
    expect(canvas.getByTestId('reveal-result')).toHaveTextContent('history')
    // A render-time mutation consumes the reveal once its 250 ms preview expires.
    await new Promise((resolve) => setTimeout(resolve, 400))
    await userEvent.click(canvas.getByRole('button', { name: 'Deliver reply' }))
    await waitFor(() => expect(canvas.getByTestId('reveal-result')).toHaveTextContent('revealing'))
  },
}
