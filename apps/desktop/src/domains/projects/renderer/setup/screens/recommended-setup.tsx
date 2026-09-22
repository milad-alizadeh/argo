import { useTranslation } from 'react-i18next'
import type { SetupDocument } from '@/domains/projects/contract/setup/setup-document'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import type { SetupSectionModel } from '../plan/setup-plan-sections'
import { SetupPlanSummary } from '../plan/setup-plan-summary'
import type { SetupAnswer } from '../use-setup-answers'
import { isJson, SetupPage } from './setup-page'

export function RecommendedSetup({
  answers,
  applyConfiguration,
  configurationSource,
  document,
  language,
  openCustomization,
  openManual,
  saving,
  sections,
}: {
  answers: Readonly<Record<string, SetupAnswer>>
  applyConfiguration: () => Promise<void>
  configurationSource: string
  document: SetupDocument
  language: string
  openCustomization: () => void
  openManual: () => void
  saving: 'apply' | 'test' | null
  sections: readonly SetupSectionModel[]
}) {
  const { t } = useTranslation('projects')
  return (
    <SetupPage
      actions={
        <>
          <Button onClick={openManual} size="lg" type="button" variant="outline">
            {t('setup.document.import')}
          </Button>
          <Button
            disabled={saving !== null || !isJson(configurationSource)}
            onClick={() => void applyConfiguration()}
            size="lg"
            type="button"
          >
            {saving === 'apply' ? t('setup.document.applying') : t('setup.document.continue')}
          </Button>
        </>
      }
    >
      <Badge variant="secondary">{t('setup.document.recommended')}</Badge>
      <h2 className="mt-3 type-title">{t('setup.document.readyTitle')}</h2>
      <p className="mt-2 max-w-2xl type-body text-muted-foreground">
        {t('setup.document.readyDescription')}
      </p>
      <section className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="type-heading">{t('setup.document.summaryTitle')}</h3>
            <p className="mt-1 type-body text-muted-foreground">
              {t('setup.document.summaryDescription')}
            </p>
          </div>
          <Button onClick={openCustomization} type="button" variant="outline">
            {t('setup.document.customize')}
          </Button>
        </div>
        <div className="mt-3 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
          <SetupPlanSummary
            answers={answers}
            document={document}
            language={language}
            sections={sections}
          />
        </div>
      </section>
    </SetupPage>
  )
}
