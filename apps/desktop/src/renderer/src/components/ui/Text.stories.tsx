import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { TEXT_ELEMENTS, Text, type TextVariant, TYPE_ROLE_CLASS } from './Text'

const VARIANTS = Object.keys(TYPE_ROLE_CLASS) as TextVariant[]

// One sample per role, phrased as the cockpit copy that role actually carries — the
// specimen has to read like the product, not like lorem ipsum.
const SPECIMEN: Record<TextVariant, string> = {
  headline: 'Changes requested · 2 blocking',
  title: 'Editing legacy.ts — now line',
  row: 'List primary text: checks, outcomes, tool rows',
  'row-strong': 'Session titles, commit subjects, buttons',
  prose: 'Multi-line reading: finding bodies, review summaries, plan docs.',
  meta: '14:32 · 1,204 tokens · +88 −12',
  tag: 'open · addressing · fixed',
  eyebrow: 'Checks · Outcomes · Merge',
  code: 'const hub = createHub({ ipc })',
  'code-inline': 'apps/desktop/src/main.ts @ 4f2a9c1',
}

const meta = {
  title: 'Cockpit/Text',
  component: Text,
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    as: { control: 'select', options: [...TEXT_ELEMENTS] },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Text>

export default meta
type Story = StoryObj<typeof meta>

// The element is a separate axis from the role, and it is invisible — so it gets a
// control plus an assertion rather than a gallery of identical-looking renders.
export const Default: Story = {
  args: { variant: 'row', children: SPECIMEN.row },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(SPECIMEN.row).tagName).toBe('SPAN')
  },
}

// Colour is not part of a role, so it composes through className — this is the proof
// that `cn` keeps the colour class next to the role instead of dropping one of them.
export const Coloured: Story = {
  args: { variant: 'meta', className: 'text-tone-run', children: SPECIMEN.meta },
  play: async ({ canvasElement }) => {
    const value = within(canvasElement).getByText(SPECIMEN.meta)
    await expect(value).toHaveClass('text-meta')
    await expect(value).toHaveClass('text-tone-run')
  },
}

// The type specimen: the whole closed ladder in one frame, which is also the
// visual-diff surface for any change to the role tuples.
export const AllVariants: Story = {
  args: { variant: 'row', children: SPECIMEN.row },
  render: () => (
    <div className="flex flex-col items-start gap-inset">
      {VARIANTS.map((variant) => (
        <div className="flex items-baseline gap-inset" key={variant}>
          <Text variant="meta" className="w-28 shrink-0 text-foreground-faint">
            {variant}
          </Text>
          <Text variant={variant}>{SPECIMEN[variant]}</Text>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(SPECIMEN.headline)).toHaveClass('text-headline')
  },
}
