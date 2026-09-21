import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Icon } from '@/platform/renderer/components/icon'
import { ICONS, type IconName } from '@/platform/renderer/components/icon-registry'

const meta = {
  title: 'Components/Icon',
  component: Icon,
  parameters: { layout: 'padded' },
  args: { name: 'search' },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

const NAMES = Object.keys(ICONS) as IconName[]

// A registry key is kebab-case for the call site; a reviewer reads it as words instead.
function readableLabel(name: IconName) {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// The vocabulary: every semantic name this repo draws an icon by, so a reviewer picks one from
// here instead of importing a lucide icon at the call site.
export const Vocabulary: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-6">
      {NAMES.map((name) => (
        <div className="flex flex-col items-center gap-2" key={name}>
          <Icon name={name} size="control" />
          <span className="type-meta text-muted-foreground">{readableLabel(name)}</span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of NAMES) {
      await expect(canvas.getByText(readableLabel(name))).toBeVisible()
    }
    await expect(canvasElement.querySelectorAll('[data-slot="icon"]')).toHaveLength(NAMES.length)
  },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <Icon aria-label="Search, meta size" name="search" size="meta" />
      <Icon aria-label="Search, inline size" name="search" size="inline" />
      <Icon aria-label="Search, control size" name="search" size="control" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const expectedSizes = [14, 14, 16]
    const icons = canvasElement.querySelectorAll('[data-slot="icon"]')
    await expect(icons).toHaveLength(expectedSizes.length)
    for (const [index, icon] of Array.from(icons).entries()) {
      await expect(icon.getBoundingClientRect().width).toBe(expectedSizes[index])
    }
  },
}

// Decorative is the default: the fact belongs to the text beside the icon, per apps/desktop/AGENTS.md.
export const Decorative: Story = {
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('[data-slot="icon"]')
    await expect(icon).toHaveAttribute('aria-hidden', 'true')
    await expect(icon).not.toHaveAttribute('aria-label')
  },
}

// An icon that stands alone as a control's whole meaning carries its own aria-label instead.
export const Labelled: Story = {
  args: { 'aria-label': 'Search' },
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('[data-slot="icon"]')
    await expect(icon).toHaveAttribute('aria-label', 'Search')
    await expect(icon).not.toHaveAttribute('aria-hidden')
  },
}
