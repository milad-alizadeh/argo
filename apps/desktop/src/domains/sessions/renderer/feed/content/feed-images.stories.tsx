import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { FeedGallery, FeedImage, FeedMissingImage } from './feed-images'
import { BROKEN_PICTURE, SAMPLE_PICTURE } from './feed-samples'
import { ImageLightbox } from './image-lightbox'

const meta = {
  title: 'Features/Sessions/Feed/Images',
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
} satisfies Meta<typeof FeedImage>

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
    await expect(within(canvasElement).getByRole('figure')).toHaveTextContent('Image unavailable')
    await expect(trigger()).toBeDisabled()
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
  },
}

export const MixedGallery: Story = {
  render: () => (
    <>
      <FeedImage source={SAMPLE_PICTURE} alt="The attached reference" />
      <FeedImage source={BROKEN_PICTURE} alt="A screenshot that no longer decodes" />
      <FeedImage source="" alt="A file the Session moved" />
    </>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(trigger()).toHaveAttribute('data-state', 'loaded'))
    await waitFor(() => expect(within(canvasElement).getAllByRole('figure')).toHaveLength(2))
    await expect(trigger()).toBeEnabled()
  },
}

async function openImage() {
  await waitFor(() => expect(trigger()).toHaveAttribute('data-state', 'loaded'))
  await userEvent.click(trigger())
  const dialog = await screen.findByRole('dialog', { name: 'The attached reference' })
  await waitFor(() => expect(dialog).toBeVisible())
  await waitFor(() =>
    expect(within(dialog).getByRole('img', { name: 'The attached reference' })).toBeVisible(),
  )
  await waitFor(() =>
    expect(within(dialog).getByRole('button', { name: 'Close image preview' })).toBeVisible(),
  )
  return dialog
}

async function expectClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(trigger()).toHaveFocus())
}

function samplePicture(width: number, height: number) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0ea5e9"/><circle cx="50%" cy="50%" r="150" fill="#f8fafc"/></svg>`)}`
}

export const OpenLandscape: Story = {
  args: { source: samplePicture(1800, 1000) },
  play: async () => {
    const dialog = await openImage()
    await expect(dialog).toHaveAccessibleDescription('Full-size image preview')
    const download = within(dialog).getByRole('button', { name: 'Download The attached reference' })
    await expect(download).toHaveAttribute('download', 'The attached reference')
  },
}

export const OpenPortrait: Story = {
  args: { source: samplePicture(1000, 1800) },
  play: async () => {
    await openImage()
  },
}

export const CloseButton: Story = {
  play: async () => {
    const dialog = await openImage()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close image preview' }))
    await expectClosed()
  },
}

export const CloseScrim: Story = {
  play: async () => {
    const dialog = await openImage()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close image preview backdrop' }),
    )
    await expectClosed()
  },
}

export const Download: Story = {
  play: async () => {
    const dialog = await openImage()
    const download = within(dialog).getByRole('button', { name: 'Download The attached reference' })
    await expect(download).toHaveAttribute('href', SAMPLE_PICTURE)
    await expect(download).toHaveAttribute('download', 'The attached reference')
    const activate = fn((event: Event) => event.preventDefault())
    download.addEventListener('click', activate)
    try {
      await userEvent.click(download)
      await expect(activate).toHaveBeenCalledOnce()
      await expect(dialog).toBeVisible()
    } finally {
      download.removeEventListener('click', activate)
    }
  },
}

export const Reopen: Story = {
  play: async () => {
    for (let opening = 0; opening < 2; opening++) {
      const dialog = await openImage()
      const preview = within(dialog).getByRole('img', { name: 'The attached reference' })
      await waitFor(() => expect(preview.getAnimations()).toHaveLength(0))
      await userEvent.keyboard('{Escape}')
      await expectClosed()
    }
  },
}

export const CompactPreview: Story = {
  args: { compact: true },
  play: async () => {
    await openImage()
    await userEvent.keyboard('{Escape}')
    await expectClosed()
  },
}

// A story can answer the motion query without changing the host system preference.
export const ReducedMotion: Story = {
  beforeEach: () => {
    const system = window.matchMedia
    window.matchMedia = (query) =>
      query === '(prefers-reduced-motion: reduce)'
        ? ({ matches: true, media: query } as MediaQueryList)
        : system.call(window, query)
    return () => {
      window.matchMedia = system
    }
  },
  play: async () => {
    const dialog = await openImage()
    await expect(
      within(dialog).getByRole('img', { name: 'The attached reference' }).getAnimations(),
    ).toHaveLength(0)
    await expect(
      within(dialog).getByRole('button', { name: 'Close image preview backdrop' }).getAnimations(),
    ).toHaveLength(0)
    await userEvent.keyboard('{Escape}')
    await expectClosed()
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
    await expect(within(dialog).getByRole('img', { name: 'The attached reference' })).toBeVisible()
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Download The attached reference' }),
      ).toHaveFocus(),
    )
    await userEvent.tab()
    await expect(within(dialog).getByRole('button', { name: 'Close image preview' })).toHaveFocus()
    await userEvent.tab()
    await expect(
      within(dialog).getByRole('button', { name: 'Download The attached reference' }),
    ).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expectClosed()
  },
}
