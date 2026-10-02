import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { expect, within } from 'storybook/test'
import type { ComposerCommand } from '@/domains/sessions/api/composer-commands'
import { replaceComposerCommands } from './composer-command-registry'
import { SessionReferenceText } from './session-reference'

const commands: readonly ComposerCommand[] = [
  { name: 'implement', description: 'Build an approved ticket', argumentHint: '', aliases: [] },
]

function ReferenceFixture() {
  useEffect(() => {
    replaceComposerCommands('claude', commands)
    return () => replaceComposerCommands('claude', [])
  }, [])

  return (
    <p className="max-w-2xl p-6 type-prose">
      Read <SessionReferenceText harness="claude" text="/implement" /> before sending.
    </p>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Inline References',
  component: SessionReferenceText,
  render: () => <ReferenceFixture />,
} satisfies Meta<typeof SessionReferenceText>

export default meta
type Story = StoryObj<typeof SessionReferenceText>

export const ReactSessionReference: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('/implement')).toBeVisible()
    await expect(canvasElement).toHaveTextContent('Read /implement before sending.')
  },
}
