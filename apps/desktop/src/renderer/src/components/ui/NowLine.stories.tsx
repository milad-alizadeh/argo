import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { MagnifyingGlassIcon, PencilSimpleIcon } from './icons'
import { NowLine } from './NowLine'
import { Text } from './Text'

const meta = {
  title: 'Cockpit/NowLine',
  component: NowLine,
  // The strip fills the story pane's width — a fixed frame is what lets the line truncate.
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  // icon and line are composed nodes, not controllable values — they are covered by the
  // stories below; only the live flag gets a control.
  argTypes: {
    icon: { control: false },
    line: { control: false },
    live: { control: 'boolean' },
  },
} satisfies Meta<typeof NowLine>

export default meta
type Story = StoryObj<typeof meta>

// The running strip: a leading verb icon, a line embedding a mono path span, and the static
// `live` word + dot at the trailing edge.
export const Live: Story = {
  args: {
    icon: <PencilSimpleIcon aria-hidden />,
    line: (
      <>
        Editing{' '}
        <Text variant="code-inline" className="text-primary-soft">
          src/renderer/src/components/ui/WorkspaceIdentity.tsx
        </Text>
      </>
    ),
    live: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('live')).toBeInTheDocument()
    await expect(
      canvas.getByText('src/renderer/src/components/ui/WorkspaceIdentity.tsx'),
    ).toBeInTheDocument()
  },
}

// Not running: the same quiet strip with no `live` indicator at all.
export const Idle: Story = {
  args: {
    icon: <MagnifyingGlassIcon aria-hidden />,
    line: 'Waiting on review before the next step',
    live: false,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('live')).not.toBeInTheDocument()
  },
}
