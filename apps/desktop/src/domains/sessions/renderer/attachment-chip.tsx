import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { attachmentKindOf } from '@/domains/sessions/api/attachments'
import { fileImageUrl } from '@/domains/sessions/api/feed'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/platform/renderer/components/ui/attachment'

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
      className="w-(--size-composer-attachment-chip-max)!"
      orientation="vertical"
      size="default"
      state={failed ? 'error' : 'done'}
    >
      <AttachmentMedia variant={isImage ? 'image' : 'icon'}>
        {isImage ? <img alt={name} src={fileImageUrl(path) ?? undefined} /> : <Icon name="file" />}
      </AttachmentMedia>
      {!isImage && (
        <AttachmentContent>
          <AttachmentTitle title={name}>{title}</AttachmentTitle>
          <AttachmentDescription>
            {failed
              ? t('composer.attachment.notFound')
              : t('composer.attachment.fileType', { extension: extension?.toUpperCase() })}
          </AttachmentDescription>
        </AttachmentContent>
      )}
      {children}
    </Attachment>
  )
}
