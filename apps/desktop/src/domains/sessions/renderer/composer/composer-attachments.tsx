import { useTranslation } from 'react-i18next'
import { AttachmentChip, parseFilename } from '@/domains/sessions/renderer/attachment-chip'
import { Icon } from '@/platform/renderer/components/icon'
import {
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
} from '@/platform/renderer/components/ui/attachment'
import type { ComposerAttachment } from './use-composer-store'

export type ComposerAttachmentsProps = {
  attachments: ComposerAttachment[]
  onRemove: (id: string) => void
}

export function ComposerAttachments({ attachments, onRemove }: ComposerAttachmentsProps) {
  const { t } = useTranslation('sessions')
  if (attachments.length === 0) return null
  return (
    <AttachmentGroup className="flex-nowrap gap-(--spacing-composer-attachment-gutter) overflow-x-auto scroll-p-(--spacing-composer-attachment-gutter) p-(--spacing-composer-attachment-gutter)">
      {attachments.map((attachment) => (
        <AttachmentChip
          failed={attachment.status === 'error'}
          key={attachment.id}
          path={attachment.path}
        >
          <AttachmentActions className="absolute top-0 right-0">
            <AttachmentAction
              aria-label={t('composer.attachment.remove', {
                title: parseFilename(attachment.path).title,
              })}
              onClick={() => onRemove(attachment.id)}
            >
              <Icon name="close" />
            </AttachmentAction>
          </AttachmentActions>
        </AttachmentChip>
      ))}
    </AttachmentGroup>
  )
}
