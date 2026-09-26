import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/renderer/model/models'
import type { WorkspaceSummary } from '@/domains/workspaces/renderer'
import { claudeComposerModelCatalogFixture } from '../../../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
import type { SessionHarness } from '../../harness/harnesses'
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

const WORKSPACE_CANDIDATES: [WorkspaceSummary, WorkspaceSummary] = [
  {
    id: 'workspace-main',
    kind: 'main',
    displayName: 'argo',
    path: '/Users/milad/Developer/argo',
    facts: { branch: 'main', headSha: 'abc1234', dirty: false },
  },
  {
    id: 'workspace-imported',
    kind: 'imported',
    displayName: 'linked-feature',
    path: '/Users/milad/Developer/argo-linked',
    facts: { branch: 'feature/linked', headSha: 'def5678', dirty: true },
  },
]

// Every control the composer can show at once, for visual/manual review rather than a behaviour
// assertion: plan, harness, turn turnConfiguration and the Workspace picker together.
function EverythingComposerStory() {
  const [sessionId] = useState('session-one')
  const [harness, setHarness] = useState<SessionHarness>('claude')
  const [turnConfiguration, setTurnConfiguration] = useState(CLAUDE_TURN_CONFIGURATION.opening)
  const [selectedId, setSelectedId] = useState(WORKSPACE_CANDIDATES[0].id)
  const selected = WORKSPACE_CANDIDATES.find((candidate) => candidate.id === selectedId) ?? null

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
      workspace={{
        workspace: selected,
        workspaces: WORKSPACE_CANDIDATES,
        onSelect: setSelectedId,
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
// and the Workspace picker. Manual/visual review, not a behaviour assertion (each control already
// has its own dedicated story above).
export const Everything: Story = { tags: ['view-only'] }
