import { useTranslation } from 'react-i18next'
import type { SetupDocument } from '@/domains/projects/contract/setup/setup-document'
import { Button } from '@/platform/renderer/components/ui/button'
import { SetupPlanCustomization } from '../plan/setup-plan-customization'
import type { SetupSectionModel } from '../plan/setup-plan-sections'
import type { SetupAnswer } from '../use-setup-answers'
import { BackButton, isJson, SetupPage } from './setup-page'

export function CustomizeSetup({
  answers,
  applyConfiguration,
  configurationSource,
  document,
  language,
  onBack,
  saving,
  sections,
  testConfiguration,
  update,
}: {
  answers: Readonly<Record<string, SetupAnswer>>
  applyConfiguration: () => Promise<void>
  configurationSource: string
  document: SetupDocument
  language: string
  onBack: () => void
  saving: 'apply' | 'test' | null
  sections: readonly SetupSectionModel[]
  testConfiguration: () => Promise<void>
  update: (id: string, value: SetupAnswer) => void
}) {
  const { t } = useTranslation('projects')
  const disabled = saving !== null || !isJson(configurationSource)
  return (
    <form
      className="h-full min-h-0"
      onSubmit={(event) => {
        event.preventDefault()
        void applyConfiguration()
      }}
    >
      <SetupPage
        actions={
          <>
            <Button
              disabled={disabled}
              onClick={() => void testConfiguration()}
              type="button"
              variant="outline"
            >
              {saving === 'test' ? t('setup.testing') : t('setup.document.testSetup')}
            </Button>
            <Button disabled={disabled} type="submit">
              {saving === 'apply' ? t('setup.document.applying') : t('setup.document.apply')}
            </Button>
          </>
        }
      >
        <BackButton onClick={onBack} />
        <h2 className="mt-4 type-title">{t('setup.document.customizeTitle')}</h2>
        <div className="mt-8 space-y-5">
          <SetupPlanCustomization
            answers={answers}
            document={document}
            language={language}
            sections={sections}
            update={update}
          />
        </div>
      </SetupPage>
    </form>
  )
}
