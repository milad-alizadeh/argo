import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import * as icons from './index'

const meta = {
  title: 'Cockpit/Icon',
  component: icons.GearIcon,
  parameters: {
    docs: {
      description: {
        component:
          'One stories file for the whole set: the inventory has a single `Icon` row, and every atom is the same factory output, so the props are storied once on a representative glyph and `AllGlyphs` covers the `name` axis.',
      },
    },
  },
} satisfies Meta<typeof icons.GearIcon>

export default meta
type Story = StoryObj<typeof meta>

const glyph = (canvasElement: HTMLElement): SVGSVGElement => {
  const svg = canvasElement.querySelector('svg')
  if (!svg) throw new Error('no glyph rendered')
  return svg
}

const boxOf = (canvasElement: HTMLElement): number =>
  glyph(canvasElement).getBoundingClientRect().width

/**
 * A glyph's box is 1em, so it sizes off whatever type role it lands in — and the factory pins
 * the Light weight, which only the drawn geometry can prove.
 */
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

/** `icon-sm` is the one step down from 1em, for a glyph that must not out-weigh its row. */
export const Small: Story = {
  args: { className: 'icon-sm' },
  play: async ({ canvasElement }) => {
    await expect(boxOf(canvasElement)).toBeLessThan(
      Number.parseFloat(getComputedStyle(canvasElement).fontSize),
    )
  },
}

/** Explicit px wins over the 1em box — the escape hatch for a glyph standing on its own. */
export const Sized: Story = {
  args: { width: 48, height: 48 },
  play: async ({ canvasElement }) => {
    await expect(boxOf(canvasElement)).toBe(48)
  },
}

/** Beside a visible word the glyph is decoration, so it stays out of the a11y tree entirely. */
export const Decorative: Story = {
  args: { 'aria-hidden': true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).toBeNull()
  },
}

/** Carrying meaning alone, a glyph has to name itself — `role` and `aria-label` together. */
export const Labelled: Story = {
  args: { role: 'img', 'aria-label': 'Settings' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Settings' })).toBeVisible()
  },
}

/** A glyph is tinted by whatever it sits in — never by a colour prop, a weight, or a fill. */
export const Tinted: Story = {
  render: (args) => (
    <div className="flex items-center gap-gap">
      <span className="text-tone-run">
        <icons.CircleNotchIcon {...args} />
      </span>
      <span className="text-tone-amber">
        <icons.WarningIcon {...args} />
      </span>
      <span className="text-tone-red">
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

/**
 * Set in running prose, where the 1em box has to hold the line's rhythm rather than break it.
 */
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

/**
 * The `name` axis: every export off the barrel in one frame, so a glyph added or dropped is a
 * visual diff rather than a silent change.
 */
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
