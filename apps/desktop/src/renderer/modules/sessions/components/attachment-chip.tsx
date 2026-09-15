import { File } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { attachmentKindOf } from '@/core/sessions/attachments-contract'
import { fileImageUrl } from '@/core/sessions/feed-images'
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/renderer/components/ui/attachment'

// `path` is the file's absolute path on disk.
export function parseFilename(path: string): {
  name: string
  title: string
  extension: string | null
} {
  const name = path.split('/').at(-1) ?? path
  const separator = name.lastIndexOf('.')
  if (separator < 1 || separator === name.length - 1) return { name, title: name, extension: null }
  return { name, title: name.slice(0, separator), extension: name.slice(separator + 1) }
}

// One attached file as the composer shows it before Send and the prompt bubble shows it after.
export function AttachmentChip({
  path,
  failed = false,
  children,
}: {
  path: string
  failed?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation('sessions')
  const isImage = attachmentKindOf(path) === 'image'
  const { name, title, extension } = parseFilename(path)
  return (
    <Attachment
      className="relative h-(--size-composer-attachment) w-fit min-w-(--size-composer-attachment-chip-min) max-w-(--size-composer-attachment-chip-max) shrink-0 items-start border-border"
      size="xs"
      state={failed ? 'error' : 'done'}
    >
      <AttachmentMedia
        className="relative !size-(--size-attachment-thumbnail) overflow-hidden rounded-lg bg-muted"
        variant={isImage ? 'image' : 'icon'}
      >
        {isImage ? (
          <img
            alt=""
            className="absolute inset-0 !size-full object-cover"
            src={fileImageUrl(path) ?? undefined}
          />
        ) : (
          <File className="size-6" />
        )}
      </AttachmentMedia>
      <AttachmentContent className="!min-w-0 !max-w-28 self-start overflow-hidden pr-6">
        <AttachmentTitle
          className="!block !max-w-24 !overflow-hidden !text-ellipsis !whitespace-nowrap type-label"
          title={name}
        >
          {title}
        </AttachmentTitle>
        <AttachmentDescription className="type-meta">
          {failed
            ? t('composer.attachment.notFound')
            : t('composer.attachment.fileType', { extension: extension?.toUpperCase() })}
        </AttachmentDescription>
      </AttachmentContent>
      {children}
    </Attachment>
  )
}
