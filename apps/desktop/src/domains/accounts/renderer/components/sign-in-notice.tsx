import { useTranslation } from 'react-i18next'
import { Notice } from '@/platform/renderer/components/design-system/notice'
import { Button } from '@/platform/renderer/components/ui/button'

export type SignInNoticeProps = { onConnect: () => void; onDismiss: () => void }

// Shown to everyone once (#1763): only a keychain read could tell who had Accounts in the Swift app.
// A card above the sidebar's Account foot, beside the Accounts it asks the person to connect.
export function SignInNotice({ onConnect, onDismiss }: SignInNoticeProps) {
  const { t } = useTranslation('accounts')
  return (
    <Notice
      aria-label={t('notice.label')}
      className="mx-(--spacing-shell-item) mb-(--spacing-shell-item) min-w-0 w-auto shrink-0"
      heading={t('notice.title')}
      icon="info"
      role="region"
      tone="neutral"
    >
      <div className="grid gap-(--spacing-shell-item)">
        <p>{t('notice.body')}</p>
        <div className="flex flex-wrap gap-(--spacing-shell-item)">
          <Button onClick={onConnect} size="sm">
            {t('notice.connect')}
          </Button>
          <Button onClick={onDismiss} size="sm" variant="ghost">
            {t('notice.dismiss')}
          </Button>
        </div>
      </div>
    </Notice>
  )
}
