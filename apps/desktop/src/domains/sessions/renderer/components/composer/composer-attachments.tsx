import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
} from '@/renderer/components/ui/attachment'
import type { ComposerAttachment } from '../../state/use-composer-store'
import { AttachmentChip, parseFilename } from '../attachment-chip'

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
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </AttachmentChip>
      ))}
    </AttachmentGroup>
  )
}
