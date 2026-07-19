import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { GearIcon } from './GearIcon'
import * as icons from './index'

const meta = {
  title: 'Cockpit/Icon',
  component: GearIcon,
} satisfies Meta<typeof GearIcon>

export default meta
type Story = StoryObj<typeof meta>

const glyph = (canvasElement: HTMLElement): SVGSVGElement => {
  const svg = canvasElement.querySelector('svg')
  if (!svg) throw new Error('no glyph rendered')
  return svg
}

const boxOf = (canvasElement: HTMLElement): number =>
  glyph(canvasElement).getBoundingClientRect().width

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(boxOf(canvasElement)).toBe(
      Number.parseFloat(getComputedStyle(canvasElement).fontSize),
    )
    // The Light gear's outer ring starts at r=46; every heavier weight draws a
    // different one, so this is the weight pin asserted on the rendered geometry.
    const path = glyph(canvasElement).querySelector('path')?.getAttribute('d')
    await expect(path).toMatch(/^M128,82a46,46/)
  },
}

export const Small: Story = {
  args: { className: 'icon-sm' },
  play: async ({ canvasElement }) => {
    await expect(boxOf(canvasElement)).toBeLessThan(
      Number.parseFloat(getComputedStyle(canvasElement).fontSize),
    )
  },
}

export const Sized: Story = {
  args: { width: 48, height: 48 },
  play: async ({ canvasElement }) => {
    await expect(boxOf(canvasElement)).toBe(48)
  },
}

export const Decorative: Story = {
  args: { 'aria-hidden': true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).toBeNull()
  },
}

export const Labelled: Story = {
  args: { role: 'img', 'aria-label': 'Settings' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Settings' })).toBeVisible()
  },
}

// A glyph is tinted by whatever it sits in — never by a colour prop, a weight, or a fill.
export const Tinted: Story = {
  render: (args) => (
    <div className="flex items-center gap-gap">
      <span className="text-status-working">
        <icons.CircleNotchIcon {...args} />
      </span>
      <span className="text-status-awaiting-input">
        <icons.WarningIcon {...args} />
      </span>
      <span className="text-status-failed">
        <icons.ProhibitIcon {...args} />
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const fills = [...canvasElement.querySelectorAll('svg')].map(
      (svg) => getComputedStyle(svg).fill,
    )
    await expect(new Set(fills).size).toBe(3)
  },
}

export const InlineWithText: Story = {
  render: (args) => (
    <p className="text-foreground text-row">
      Branch <icons.GitBranchIcon {...args} /> <span className="text-code-inline">feat/rail</span>{' '}
      is ahead <icons.ArrowLineUpIcon {...args} className="icon-sm" /> of main.
    </p>
  ),
}

const GLYPHS = Object.entries(icons).filter(
  (entry): entry is [string, icons.IconAtom] => typeof entry[1] === 'function',
)

export const AllGlyphs: Story = {
  render: (args) => (
    <div className="grid grid-cols-6 gap-region text-foreground-soft text-title">
      {GLYPHS.map(([name, Glyph]) => (
        <span className="flex flex-col items-center gap-tight" key={name}>
          <Glyph {...args} />
          <span className="text-foreground-faint text-meta">{name}</span>
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('svg')).toHaveLength(GLYPHS.length)
  },
}
