import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'

export function OpenProjectButton() {
  const { t } = useTranslation('projects')
  return (
    <Button disabled title={t('onboarding.flow.openProjectUnavailable')}>
      {t('onboarding.flow.openProject')}
    </Button>
  )
}
