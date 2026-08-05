import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ActivityPane } from '../components/ActivityPane'
import { chapters } from './feedIndex'
import { LONG_INTERIOR } from './longSession'
import { PrototypeShell } from './PrototypeShell'
import { PrototypeSwitcher, type Variant } from './PrototypeSwitcher'
import { VariantChapters } from './VariantChapters'
import { VariantGutter } from './VariantGutter'
import { VariantLens } from './VariantLens'
import { VariantPlacements } from './VariantPlacements'
import { VariantStrip } from './VariantStrip'
import { VariantSynthesis } from './VariantSynthesis'

// PROTOTYPE — throwaway. See ./README.md for the question and the four answers.

const ACTIVITY = LONG_INTERIOR.activity
const CHAPTERS = chapters(ACTIVITY)
const PLAN = ACTIVITY.plan

const VARIANTS: Variant[] = [
  {
    key: '0',
    name: 'Shipped — two panes (the baseline)',
    body: <ActivityPane activity={ACTIVITY} />,
  },
  { key: 'A', name: 'Density gutter', body: <VariantGutter chapters={CHAPTERS} /> },
  { key: 'B', name: 'Chapters', body: <VariantChapters chapters={CHAPTERS} plan={PLAN} /> },
  { key: 'C', name: 'Lens + ⌘K', body: <VariantLens chapters={CHAPTERS} /> },
  { key: 'D', name: 'Strip', body: <VariantStrip chapters={CHAPTERS} plan={PLAN} /> },
  {
    key: 'E',
    name: 'Synthesis — gutter snap · sticky seams · scoped subagents · thumbs',
    body: <VariantSynthesis chapters={CHAPTERS} plan={PLAN} />,
  },
  {
    key: 'F1',
    name: 'Subagents: chips bar',
    body: <VariantPlacements chapters={CHAPTERS} plan={PLAN} placement="chips" />,
  },
  {
    key: 'F2',
    name: 'Subagents: right rail',
    body: <VariantPlacements chapters={CHAPTERS} plan={PLAN} placement="rail" />,
  },
  {
    key: 'F3',
    name: 'Subagents: seam chip',
    body: <VariantPlacements chapters={CHAPTERS} plan={PLAN} placement="seam" />,
  },
]

const DEFAULT_AT = VARIANTS.findIndex((variant) => variant.key === 'F1')

function Prototype(): React.JSX.Element {
  const [at, setAt] = useState(DEFAULT_AT)
  return (
    <>
      <PrototypeShell>{VARIANTS[at]?.body}</PrototypeShell>
      <PrototypeSwitcher variants={VARIANTS} at={at} onGo={setAt} />
    </>
  )
}

const meta = {
  title: 'Prototype/Feed navigation',
  component: Prototype,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-screen w-screen bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Prototype>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Five readings of the same eight-turn session, on the real plane. `←`/`→` cycles; `⌥↑`/`⌥↓` steps
 * the feed turn to turn in every variant; variant C also answers `⌘K`.
 *
 * `0` is the shipped two-pane surface, in the set deliberately: the complaint is comparative, so the
 * thing being complained about has to be one keypress away from each replacement.
 */
export const Variants: Story = {}
