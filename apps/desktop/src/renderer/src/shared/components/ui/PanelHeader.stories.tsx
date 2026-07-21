import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { IconButton } from './IconButton'
import { PlusIcon } from './icons'
import { PanelHeader } from './PanelHeader'
import { Text } from './Text'

const meta = {
  title: 'Shared/PanelHeader',
  component: PanelHeader,
  parameters: { layout: 'padded' },
  args: {
    left: (
      <Text as="span" variant="eyebrow" className="text-muted-foreground">
        Projects
      </Text>
    ),
    right: (
      <IconButton label="New session">
        <PlusIcon aria-hidden className="size-4" />
      </IconButton>
    ),
  },
} satisfies Meta<typeof PanelHeader>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The shared spine header: a left slot that grows and a right slot pinned to the end, over the
 * fixed strip height and hairline both the roster and the session panel wear.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Projects')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New session' })).toBeInTheDocument()
  },
}

/** With no trailing control the bar keeps its height and border — only the right slot is gone. */
export const LeftOnly: Story = {
  args: { right: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Projects')).toBeInTheDocument()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}
