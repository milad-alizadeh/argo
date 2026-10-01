import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Harness } from '@/harnesses/harness'
import { claudeComposerModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '@/mocks/sessions/harness-catalog.fixture'
import type { SessionPlan } from '../../types'
import type { WorktreeSummary } from '../toolbar/use-worktree-choices'
import { ComposerForm } from '../layout/composer-form'
import type { TurnConfigurationChoices } from '../turn-configuration/turn-configuration'

const CLAUDE_TURN_CONFIGURATION = (() => {
  const choices = claudeChoices(claudeComposerModelCatalogFixture())
  if (choices === null) throw new Error('The Claude story catalog has no usable model.')
  return choices
})() satisfies TurnConfigurationChoices

const FRAME = 'mx-auto max-w-4xl p-8'

const plan: SessionPlan = {
  state: 'available' as const,
  entries: [{ content: 'Choose the base layout', position: 0, status: 'in_progress' as const }],
}

const WORKTREE_CANDIDATES: [WorktreeSummary, WorktreeSummary] = [
  { path: '/Users/milad/Developer/argo', main: true, name: 'argo', branch: 'main' },
  {
    path: '/Users/milad/Developer/linked-feature',
    main: false,
    name: 'linked-feature',
    branch: 'feature/linked',
  },
]

// Every control the composer can show at once, for visual/manual review rather than a behaviour
// assertion: plan, harness, turn turnConfiguration and the worktree picker together.
function EverythingComposerStory() {
  const [sessionId] = useState('session-one')
  const [harness, setHarness] = useState<Harness>('claude')
  const [turnConfiguration, setTurnConfiguration] = useState(CLAUDE_TURN_CONFIGURATION.opening)
  const [choice, setChoice] = useState('new')

  return (
    <ComposerForm
      contextTokens={12_000}
      contextWindowTokens={200_000}
      harness={{ harness, onChange: setHarness }}
      onSend={async () => true}
      plan={plan}
      sessionId={sessionId}
      turnConfiguration={{
        choices: CLAUDE_TURN_CONFIGURATION,
        value: turnConfiguration,
        onChange: setTurnConfiguration,
      }}
      worktree={{
        choice,
        saveFailed: false,
        worktrees: WORKTREE_CANDIDATES,
        onSelect: setChoice,
      }}
    />
  )
}

const meta = {
  title: 'Sessions/Composer',
  component: EverythingComposerStory,
  decorators: [
    (Story, { parameters }) => (
      <div className={(parameters.frame as string | undefined) ?? FRAME}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EverythingComposerStory>

export default meta
type Story = StoryObj<typeof EverythingComposerStory>

// A single visual reference showing every composer control together: plan, harness, turn turnConfiguration
// and the worktree picker. Manual/visual review, not a behaviour assertion (each control already
// has its own dedicated story above).
export const Everything: Story = { tags: ['view-only'] }
