import type { Meta, StoryObj } from '@storybook/react'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'
import { roleColors } from './appearanceProbe'
import { FeedGallery, FeedImage, FeedMissingImage, ImageLightbox } from './FeedImages'
import { BROKEN_PICTURE, SAMPLE_PICTURE } from './feedSamples'

const meta: Meta<typeof FeedImage> = {
  title: 'Sessions/Feed/Images',
  component: FeedImage,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <FeedGallery>
          <Story />
        </FeedGallery>
      </div>
    ),
  ],
  args: { source: SAMPLE_PICTURE, alt: 'The attached reference' },
}

export default meta
type Story = StoryObj<typeof FeedImage>

const trigger = () =>
  screen.getByRole('button', { name: 'Open The attached reference in lightbox' })

export const Loaded: Story = {
  play: async () => {
    await waitFor(() => expect(trigger()).toHaveAttribute('data-state', 'loaded'))
    await expect(
      within(trigger()).getByRole('img', { name: 'The attached reference' }),
    ).toBeVisible()
  },
}

// The frame an image holds while it decodes: an empty card at the failure card's size.
export const Loading: Story = {
  render: () => (
    <>
      <ImageLightbox
        image={{
          source: SAMPLE_PICTURE,
          alt: 'The attached reference',
          title: 'The attached reference',
        }}
        loading
      />
      <FeedMissingImage label="A file the Session moved" />
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(trigger()).toHaveAttribute('data-state', 'loading')
    await expect(trigger().querySelector('img')).not.toBeVisible()
    await userEvent.tab()
    await expect(trigger()).not.toHaveFocus()
    await userEvent.click(trigger(), { pointerEventsCheck: 0 })
    await expect(screen.queryByRole('dialog')).toBeNull()
    const card = within(canvasElement).getByRole('figure').getBoundingClientRect()
    await expect(trigger().getBoundingClientRect().width).toBe(card.width)
    await expect(trigger().getBoundingClientRect().height).toBe(card.height)
  },
}

// Both failures draw the same card: a file that does not decode, and a source the Feed refuses,
// such as a path relative to a folder the row does not carry.
export const Unavailable: Story = {
  render: () => (
    <>
      <FeedImage source={BROKEN_PICTURE} alt="A screenshot that no longer decodes" />
      <FeedImage source="" alt="A file the Session moved" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getAllByRole('figure')).toHaveLength(2))
    const [broken, refused] = canvas.getAllByRole('figure')
    await expect(broken).toHaveTextContent('Image unavailableA screenshot that no longer decodes')
    await expect(refused).toHaveTextContent('Image unavailableA file the Session moved')
    await expect(canvas.queryByRole('button')).toBeNull()
    const card = getComputedStyle(broken?.firstElementChild ?? canvasElement)
    const roles = roleColors('bg-card text-muted-foreground')
    await expect(card.backgroundColor).toBe(roles.backgroundColor)
    await expect(card.color).toBe(roles.color)
  },
}

// Every state stands in the gallery's one reserved height, so a load or a failure changes no row.
export const ReservedHeight: Story = {
  render: () => (
    <>
      <FeedImage source={SAMPLE_PICTURE} alt="The attached reference" />
      <FeedImage source={BROKEN_PICTURE} alt="A screenshot that no longer decodes" />
      <FeedImage source="" alt="A file the Session moved" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const gallery = canvasElement.querySelector('[data-component="FeedGallery"]')
    await waitFor(() => expect(trigger()).toHaveAttribute('data-state', 'loaded'))
    await waitFor(() =>
      expect(within(canvasElement).getAllByText('Image unavailable')).toHaveLength(2),
    )
    const height = gallery?.getBoundingClientRect().height
    for (const image of gallery?.children ?? [])
      await expect(image.getBoundingClientRect().height).toBe(height)
  },
}

export const LightboxFromKeyboard: Story = {
  play: async () => {
    await waitFor(() => expect(trigger()).toHaveAttribute('data-state', 'loaded'))
    await userEvent.tab()
    await expect(trigger()).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Close image preview' })).toBeVisible(),
    )
    const preview = within(dialog).getByRole('img', { name: 'The attached reference' })
    await expect(preview.getBoundingClientRect().width).toBeGreaterThan(0)
    await expect(preview.getBoundingClientRect().height).toBeGreaterThan(0)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await expect(trigger()).toHaveFocus()
  },
}
