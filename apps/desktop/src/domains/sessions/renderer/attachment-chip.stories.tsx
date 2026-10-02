import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTrigger,
} from '@/platform/renderer/components/ui/attachment'
import { AttachmentChip } from './attachment-chip'

const meta = {
  title: 'Features/Sessions/Composer/Attachment Chip',
  component: AttachmentChip,
  args: { path: '/repo/notes.md' },
} satisfies Meta<typeof AttachmentChip>

export default meta
type Story = StoryObj<typeof AttachmentChip>

const images = [
  {
    name: 'workspace.png',
    alt: 'Workspace',
    src: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'desk-reference.jpg',
    alt: 'Desk',
    src: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'office-reference.jpg',
    alt: 'Office',
    src: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&auto=format&fit=crop&q=80',
  },
]

export const Cards: Story = {
  tags: ['view-only'],
  render: () => (
    <AttachmentGroup className="w-full items-start">
      <AttachmentChip path="/repo/message-renderer.tsx">
        <AttachmentActions>
          <AttachmentAction aria-label="Remove message-renderer.tsx">
            <Icon name="close" />
          </AttachmentAction>
        </AttachmentActions>
      </AttachmentChip>
      {images.map((image) => (
        <Attachment
          key={image.name}
          className="w-(--size-composer-attachment-chip-max)"
          orientation="vertical"
        >
          <AttachmentMedia variant="image">
            <img alt={image.alt} src={image.src} />
          </AttachmentMedia>
          <AttachmentActions>
            <AttachmentAction aria-label={`Remove ${image.name}`}>
              <Icon name="close" />
            </AttachmentAction>
          </AttachmentActions>
          <AttachmentTrigger
            render={
              <a
                href={image.src}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${image.name}`}
              />
            }
          />
        </Attachment>
      ))}
    </AttachmentGroup>
  ),
}
