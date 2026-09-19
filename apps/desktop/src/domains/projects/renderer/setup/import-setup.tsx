import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import { Textarea } from '@/platform/renderer/components/ui/textarea'
import { BackButton, isJson, SetupPage } from './setup-page'

export function ImportSetup({
  applyConfiguration,
  configurationSource,
  onBack,
  onConfigurationChange,
  saving,
  testConfiguration,
}: {
  applyConfiguration: () => Promise<void>
  configurationSource: string
  onBack: () => void
  onConfigurationChange: (source: string) => void
  saving: 'apply' | 'test' | null
  testConfiguration: () => Promise<void>
}) {
  const { t } = useTranslation('projects')
  const valid = isJson(configurationSource)
  return (
    <SetupPage
      actions={
        <>
          <Button
            disabled={saving !== null || !valid}
            onClick={() => void testConfiguration()}
            type="button"
            variant="outline"
          >
            {saving === 'test' ? t('setup.testing') : t('setup.document.testConfiguration')}
          </Button>
          <Button
            disabled={saving !== null || !valid}
            onClick={() => void applyConfiguration()}
            type="button"
          >
            {saving === 'apply' ? t('setup.document.applying') : t('setup.document.import')}
          </Button>
        </>
      }
    >
      <BackButton onClick={onBack} />
      <h2 className="mt-4 type-title">{t('setup.document.importTitle')}</h2>
      <p className="mt-3 type-body text-muted-foreground">
        {t('setup.document.importDescription')}
      </p>
      <Textarea
        aria-invalid={!valid}
        aria-label={t('setup.configurationLabel')}
        className="project-setup-import-source mt-8 resize-y font-mono"
        onChange={(event) => onConfigurationChange(event.target.value)}
        value={configurationSource}
      />
    </SetupPage>
  )
}
