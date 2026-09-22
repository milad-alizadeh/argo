import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { WorkspaceSummary } from '@/domains/projects/contract/workspace-messages'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import { SessionComposer } from '@/domains/sessions/renderer/composer/session-composer'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { CLAUDE_TURN_SETUP } from '@/domains/sessions/renderer/turn-setup/claude-turn-setup'

const FRAME = 'mx-auto max-w-4xl p-8'

const plan: SessionPlan = {
  state: 'available' as const,
  entries: [{ content: 'Choose the base layout', position: 0, status: 'in_progress' as const }],
}

const WORKSPACE_CANDIDATES: [WorkspaceSummary, WorkspaceSummary, WorkspaceSummary] = [
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
  {
    id: 'workspace-managed',
    kind: 'managed',
    displayName: 'ticket-2600-project-workspaces',
    path: '/Users/milad/Developer/argo/.claude/worktrees/ticket-2600-project-workspaces',
    facts: { branch: 'argo/#2600-project-workspaces', headSha: 'ghi9012', dirty: false },
  },
]

// Every control the composer can show at once, for visual/manual review rather than a behaviour
// assertion: plan, harness, turn setup and the Workspace picker together.
function EverythingComposerStory() {
  const [sessionId] = useState('session-one')
  const [harness, setHarness] = useState<SessionHarness>('claude')
  const [setup, setSetup] = useState(CLAUDE_TURN_SETUP.opening)
  const [selectedId, setSelectedId] = useState(WORKSPACE_CANDIDATES[0].id)
  const selected = WORKSPACE_CANDIDATES.find((candidate) => candidate.id === selectedId) ?? null

  return (
    <SessionComposer
      contextTokens={12_000}
      contextWindowTokens={200_000}
      harness={{ harness, onChange: setHarness }}
      onSend={async () => true}
      plan={plan}
      sessionId={sessionId}
      setup={{ choices: CLAUDE_TURN_SETUP, value: setup, onChange: setSetup }}
      workspace={{
        workspace: selected,
        workspaces: WORKSPACE_CANDIDATES,
        onCreateManaged: () => {},
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
  // Drafts outlive a story like they outlive a page, so each story starts from none.
  beforeEach: () => {
    useComposerStore.setState(useComposerStore.getInitialState())
  },
} satisfies Meta<typeof EverythingComposerStory>

export default meta
type Story = StoryObj<typeof EverythingComposerStory>

// A single visual reference showing every composer control together: plan, harness, turn setup
// and the Workspace picker. Manual/visual review, not a behaviour assertion (each control already
// has its own dedicated story above).
export const Everything: Story = { tags: ['view-only'] }
