import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PromptText } from './PromptText'

const meta: Meta<typeof PromptText> = {
  title: 'Sessions/Prompt/PromptText',
  component: PromptText,
  decorators: [
    (Story) => (
      <p className="max-w-2xl p-6 type-prose">
        <Story />
      </p>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof PromptText>

export const SkillMentionAndLink: Story = {
  args: {
    text: '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement).toHaveTextContent('Implement')
    await expect(canvasElement.querySelector('svg')).not.toBeNull()
    await expect(canvasElement).not.toHaveTextContent('[$implement]')
    const link = canvas.getByRole('link', {
      name: 'https://github.com/milad-alizadeh/argo/issues/1944',
    })
    await expect(link).toHaveAttribute('target', '_blank')
  },
}

export const PlainText: Story = {
  args: { text: 'Review the new Session shell.' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('Review the new Session shell.')
    await expect(canvasElement.querySelector('svg')).toBeNull()
  },
}

export const NonExternalLinkStaysText: Story = {
  args: { text: 'See [the note](docs/note.md) first.' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('See the note first.')
    await expect(canvasElement.querySelector('a')).toBeNull()
  },
}
