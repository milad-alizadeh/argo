import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
} from '@/platform/renderer/components/ui/attachment'
import { AttachmentChip, parseFilename } from '../../attachment-chip'
import { EMPTY_COMPOSER_ATTACHMENTS, useComposerStore } from '../hooks/use-composer-store'

export function ComposerAttachments({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation('sessions')
  const attachments = useComposerStore(
    ({ attachments }) => attachments[sessionId] ?? EMPTY_COMPOSER_ATTACHMENTS,
  )
  const removeAttachment = useComposerStore(({ removeAttachment }) => removeAttachment)
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
              onClick={() => removeAttachment(sessionId, attachment.id)}
            >
              <Icon name="close" />
            </AttachmentAction>
          </AttachmentActions>
        </AttachmentChip>
      ))}
    </AttachmentGroup>
  )
}
