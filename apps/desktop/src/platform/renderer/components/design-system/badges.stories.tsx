import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Badge } from '../ui/badge'
import { StatusBadge } from './status-badge'
import { indicatorToneRecipe, statusToneRecipe } from './tone-recipes'

export const NATIVE_BADGE_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
] as const

const removeBadge = fn()

export function NativeBadges() {
  return (
    <div className="grid justify-items-start gap-4">
      <div className="flex flex-wrap gap-2">
        {NATIVE_BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
      <Badge render={<a href="#badge-destination" />} variant="secondary">
        Badge destination
      </Badge>
      <Badge onClick={removeBadge} render={<button type="button" />} variant="destructive">
        Remove badge
      </Badge>
      <Badge render={<button disabled type="button" />} variant="secondary">
        Disabled badge
      </Badge>
      <Badge render={<a href="#badge-destination" />} variant="destructive">
        Destructive destination
      </Badge>
      <span id="badge-destination">Destination</span>
    </div>
  )
}

export function AppToneTreatments() {
  return (
    <div className="grid justify-items-start gap-4">
      <StatusBadge data-treatment="subtle" ref={React.createRef()} title="Attention" tone="warning">
        Needs input
      </StatusBadge>
      <div className="flex gap-2">
        {Object.keys(statusToneRecipe).map((tone) => (
          <StatusBadge
            data-treatment="status"
            key={tone}
            tone={tone as keyof typeof statusToneRecipe}
          >
            {tone}
          </StatusBadge>
        ))}
      </div>
      <ul className="grid gap-2">
        {Object.entries(indicatorToneRecipe).map(([tone, recipe]) => (
          <li className="flex items-center gap-2" key={tone}>
            <span
              aria-hidden="true"
              className={`size-2 rounded-full bg-current ${recipe}`}
              data-treatment="indicator"
              data-tone={tone}
            />
            {tone}
          </li>
        ))}
      </ul>
    </div>
  )
}

const meta = {
  title: 'Foundations/Primitives/Badge',
  excludeStories: ['NATIVE_BADGE_VARIANTS', 'NativeBadges', 'AppToneTreatments'],
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Native: Story = {
  beforeEach: () => {
    removeBadge.mockClear()
  },
  render: () => <NativeBadges />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const variant of NATIVE_BADGE_VARIANTS) {
      await expect(canvas.getByText(variant, { exact: true })).toBeVisible()
    }
    await expect(canvas.getByRole('link', { name: 'Badge destination' })).toHaveAttribute(
      'href',
      '#badge-destination',
    )
    const remove = canvas.getByRole('button', { name: 'Remove badge' })
    await userEvent.tab()
    await expect(canvas.getByRole('link', { name: 'Badge destination' })).toHaveFocus()
    await userEvent.tab()
    await expect(remove).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(removeBadge).toHaveBeenCalledOnce()
    await expect(canvas.getByRole('button', { name: 'Disabled badge' })).toBeDisabled()
    await expect(canvas.getByRole('link', { name: 'Destructive destination' })).toHaveAttribute(
      'href',
      '#badge-destination',
    )
  },
}

export const AppTreatments: Story = {
  render: () => <AppToneTreatments />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Needs input')).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4)
    for (const tone of ['success', 'warning', 'danger', 'neutral']) {
      await expect(canvas.getAllByText(tone, { exact: true })).toHaveLength(2)
    }
    for (const removed of ['active', 'complete']) {
      await expect(canvas.queryByText(removed, { exact: true })).toBeNull()
    }
  },
}
