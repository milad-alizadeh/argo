import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '../../../../renderer/components/ui/alert'
import { Button } from '../../../../renderer/components/ui/button'

export type SignInNoticeProps = { onConnect: () => void; onDismiss: () => void }

// Shown to everyone once (#1763): only a keychain read could tell who had Accounts in the Swift app.
// A card above the sidebar's Account foot, beside the Accounts it asks the person to connect.
export function SignInNotice({ onConnect, onDismiss }: SignInNoticeProps) {
  const { t } = useTranslation('accounts')
  return (
    <Alert
      aria-label={t('notice.label')}
      className="mx-(--spacing-shell-item) mb-(--spacing-shell-item) w-auto shrink-0 bg-muted/40"
      role="region"
    >
      <Info aria-hidden="true" />
      <AlertTitle>{t('notice.title')}</AlertTitle>
      <AlertDescription className="grid gap-(--spacing-shell-item)">
        <p>{t('notice.body')}</p>
        <div className="flex flex-wrap gap-(--spacing-shell-item)">
          <Button onClick={onConnect} size="sm">
            {t('notice.connect')}
          </Button>
          <Button onClick={onDismiss} size="sm" variant="ghost">
            {t('notice.dismiss')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
