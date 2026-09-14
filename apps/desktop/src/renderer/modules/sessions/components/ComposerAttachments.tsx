import { File, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { attachmentKindOf } from '@/core/sessions/attachments-contract'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/renderer/components/ui/attachment'
import type { ComposerAttachment, ComposerTicketContext } from '../state/useComposerStore'

// Extracted from the composer prototype's ReferenceStrip (602bcce2). The prototype names attached
// files by a bare mock path; here `path` is the file's absolute path on disk.
function parseFilename(path: string): { title: string; extension: string | null } {
  const name = path.split('/').at(-1) ?? path
  const separator = name.lastIndexOf('.')
  if (separator < 1 || separator === name.length - 1) return { title: name, extension: null }
  return { title: name.slice(0, separator), extension: name.slice(separator + 1) }
}

// POSIX only: the managed drivers this reads paths from run on macOS today (#1894, #1892 track
// Linux and Windows separately).
function fileUrl(path: string): string {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`
}

export type ComposerAttachmentsProps = {
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  onRemove: (id: string) => void
  onRemoveTicket: (id: string) => void
}

export function ComposerAttachments({
  attachments,
  tickets,
  onRemove,
  onRemoveTicket,
}: ComposerAttachmentsProps) {
  const { t } = useTranslation('sessions')
  if (attachments.length === 0 && tickets.length === 0) return null
  return (
    <AttachmentGroup className="flex-nowrap gap-(--spacing-composer-attachment-gutter) overflow-x-auto scroll-p-(--spacing-composer-attachment-gutter) p-(--spacing-composer-attachment-gutter)">
      {attachments.map((attachment) => {
        const isImage = attachmentKindOf(attachment.path) === 'image'
        const { title, extension } = parseFilename(attachment.path)
        return (
          <Attachment
            key={attachment.id}
            className="relative h-(--size-composer-attachment) w-fit min-w-(--size-composer-attachment-chip-min) max-w-(--size-composer-attachment-chip-max) shrink-0 items-start border-border py-1 pr-9 pl-2"
            size="xs"
            state={attachment.status === 'error' ? 'error' : 'done'}
          >
            <AttachmentMedia
              className="relative !size-(--size-attachment-thumbnail) overflow-hidden rounded-lg bg-muted"
              variant={isImage ? 'image' : 'icon'}
            >
              {isImage ? (
                <img
                  alt=""
                  className="absolute inset-0 !size-full object-cover"
                  src={fileUrl(attachment.path)}
                />
              ) : (
                <File className="size-6" />
              )}
            </AttachmentMedia>
            <AttachmentContent className="!min-w-0 !max-w-28 self-start overflow-hidden pr-6">
              <AttachmentTitle className="!block !max-w-24 !overflow-hidden !text-ellipsis !whitespace-nowrap type-label">
                {title}
              </AttachmentTitle>
              <AttachmentDescription className="type-meta">
                {attachment.status === 'error'
                  ? t('composer.attachment.notFound')
                  : t('composer.attachment.fileType', { extension: extension?.toUpperCase() })}
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions className="absolute top-0 right-0">
              <AttachmentAction
                aria-label={t('composer.attachment.remove', { title })}
                onClick={() => onRemove(attachment.id)}
              >
                <X />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        )
      })}
      {tickets.map((ticket) => (
        <Attachment
          key={ticket.id}
          className="relative h-(--size-composer-attachment) w-fit min-w-(--size-composer-attachment-chip-min) max-w-(--size-composer-attachment-chip-max) shrink-0 items-start border-border py-1 pr-9 pl-2"
          size="xs"
          state="done"
        >
          <AttachmentContent className="!min-w-0 !max-w-36 self-start overflow-hidden pr-6">
            <AttachmentTitle className="!block !max-w-32 !overflow-hidden !text-ellipsis !whitespace-nowrap type-label">
              {ticket.key} {ticket.title}
            </AttachmentTitle>
            <AttachmentDescription
              className={ticket.terminal ? 'type-meta text-danger' : 'type-meta'}
            >
              {t(`composer.contextPicker.provider.${ticket.provider}`)} · {ticket.status}
            </AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions className="absolute top-0 right-0">
            <AttachmentAction
              aria-label={t('composer.contextPicker.removeTicket', { key: ticket.key })}
              onClick={() => onRemoveTicket(ticket.id)}
            >
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}
