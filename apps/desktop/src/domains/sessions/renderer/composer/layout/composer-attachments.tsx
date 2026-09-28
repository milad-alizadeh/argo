import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
} from '@/platform/renderer/components/ui/attachment'
import { AttachmentChip, parseFilename } from '../../attachment-chip'
import { useComposerEditing } from '../editing/composer-editing-context'

export function ComposerAttachments() {
  const { t } = useTranslation('sessions')
  const { editing, dispatch, failedAttachmentIds } = useComposerEditing()
  const { attachments } = editing
  if (attachments.length === 0) return null
  return (
    <AttachmentGroup className="flex-nowrap gap-(--spacing-composer-attachment-gutter) overflow-x-auto scroll-p-(--spacing-composer-attachment-gutter) p-(--spacing-composer-attachment-gutter)">
      {attachments.map((attachment) => (
        <AttachmentChip
          failed={failedAttachmentIds.has(attachment.id)}
          key={attachment.id}
          path={attachment.path}
        >
          <AttachmentActions className="absolute top-0 right-0">
            <AttachmentAction
              aria-label={t('composer.attachment.remove', {
                title: parseFilename(attachment.path).title,
              })}
              onClick={() => dispatch({ type: 'attachment.removed', id: attachment.id })}
            >
              <Icon name="close" />
            </AttachmentAction>
          </AttachmentActions>
        </AttachmentChip>
      ))}
    </AttachmentGroup>
  )
}
