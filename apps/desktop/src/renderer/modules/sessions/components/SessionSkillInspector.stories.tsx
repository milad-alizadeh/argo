import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { SessionEvidenceInspector } from './SessionEvidenceInspector'

const SKILL_PATH = '/storybook/.claude/skills/implement/SKILL.md'
const SKILL_FILE = [
  '---',
  'name: implement',
  'description: Build a ticket end to end.',
  '---',
  '',
  '# Implement',
  '',
  'Build the ticket in a **worktree**, then review the diff.',
].join('\n')

// A story has no preload, so the one read the inspector makes is answered here.
function answerSkillReads(content: string | null) {
  window.argo = {
    ...window.argo,
    readSkillFile: (request: { path: string }) =>
      Promise.resolve({
        version: 1,
        type: 'session.skill.read',
        requestId: 'storybook-skill',
        content: request.path === SKILL_PATH ? content : null,
      }),
  }
}

const meta: Meta<typeof SessionEvidenceInspector> = {
  title: 'Sessions/Screen/Skill Inspector',
  component: SessionEvidenceInspector,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-dvh min-h-0 w-full">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionEvidenceInspector>

const skill = {
  shape: 'skill' as const,
  id: `skill:${SKILL_PATH}`,
  name: 'implement',
  path: SKILL_PATH,
}

export const RenderedSkill: Story = {
  args: { evidence: skill, sessionId: null },
  beforeEach: () => answerSkillReads(SKILL_FILE),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Implement' })).toBeVisible()
    await expect(canvas.getByText('worktree').tagName).toBe('STRONG')
    await expect(canvasElement).not.toHaveTextContent('description: Build a ticket')
  },
}

export const UnreadableSkill: Story = {
  args: { evidence: skill, sessionId: null },
  beforeEach: () => answerSkillReads(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("This skill's file could not be read.")).toBeVisible()
  },
}
