import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AccentCard, AccentCardHeader, type AccentCardTone } from './AccentCard'
import { Badge } from './badge'
import { Button } from './button'
import { CaretRightIcon, CheckIcon, GitMergeIcon, WarningIcon } from './icons'
import { Text } from './Text'

// The rail-card primitive shared by the Delivery panel's terminal milestone card and the review
// FindingCard: a toned left rail + wash, an eyebrow header, and a body.
const meta = {
  title: 'ui/AccentCard',
  component: AccentCard,
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccentCard>

export default meta
type Story = StoryObj<typeof meta>

/** A landed-milestone card: the `landed` tone, a glyph + eyebrow, a trailing timestamp. */
export const Landed: Story = {
  render: () => (
    <AccentCard tone="landed">
      <AccentCardHeader
        icon={<GitMergeIcon aria-hidden className="text-tone-landed" />}
        eyebrow="Landed"
        eyebrowClassName="text-tone-landed"
        trailing={
          <Text variant="meta" className="text-foreground-faint">
            2h ago
          </Text>
        }
      />
      <Text variant="row-strong" className="text-foreground-soft">
        Merged into <Text variant="code-inline">main</Text>
      </Text>
    </AccentCard>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Landed')).toBeInTheDocument()
  },
}

/** A blocking finding: the `block` tone, inline extras (line + status pill), a trailing action. */
export const Blocking: Story = {
  render: () => (
    <AccentCard tone="block">
      <AccentCardHeader
        icon={<WarningIcon aria-hidden className="text-verdict-block" />}
        eyebrow="blocking"
        eyebrowClassName="text-muted-foreground"
        trailing={
          <Button variant="verdict-approve" size="sm">
            <CheckIcon aria-hidden />
            Mark fixed
          </Button>
        }
      >
        <Text variant="meta" className="text-muted-foreground" as="span">
          :118
        </Text>
        <Badge shape="pill" variant="verdict-block">
          Open
        </Badge>
      </AccentCardHeader>
      <Text variant="prose" className="text-foreground-bright" as="p">
        The legacy path drops the audience claim when it falls back to the old token format.
      </Text>
    </AccentCard>
  ),
}

/** Every tone the frame ships, stacked. */
export const Tones: Story = {
  render: () => (
    <div className="grid gap-gap">
      {(['landed', 'neutral', 'block', 'changes', 'approve'] satisfies AccentCardTone[]).map(
        (tone) => (
          <AccentCard key={tone} tone={tone}>
            <AccentCardHeader
              icon={<CaretRightIcon aria-hidden className="text-foreground-faint" />}
              eyebrow={tone}
              eyebrowClassName="text-muted-foreground"
            />
            <Text variant="row" className="text-muted-foreground">
              rail + wash keyed to the <Text variant="code-inline">{tone}</Text> token
            </Text>
          </AccentCard>
        ),
      )}
    </div>
  ),
}
