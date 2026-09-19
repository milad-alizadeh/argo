import { useTranslation } from 'react-i18next'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import type { ProjectSetupViewProps } from '@/domains/projects/renderer/setup/project-setup-window'
import { SetupDocumentForm } from './setup-document-form'
import './project-setup.css'

export function ConfigurationPanel(props: ProjectSetupViewProps) {
  const { i18n, t } = useTranslation('projects')
  return (
    <div className="min-h-0 overflow-hidden rounded-xl border bg-card shadow-surface">
      {props.loading ? <SetupLoading /> : null}
      {!props.loading && props.document ? (
        <SetupDocumentForm
          applyConfiguration={props.applyConfiguration}
          configurationSource={props.source}
          document={props.document}
          language={i18n.language}
          onConfigurationChange={props.updateSource}
          saving={props.saving}
          testConfiguration={props.testConfiguration}
        />
      ) : null}
      {!props.loading && !props.document ? (
        <div className="mx-auto max-w-4xl px-8 py-10">
          <Badge variant="secondary">{t('setup.document.unavailable')}</Badge>
          <h2 className="mt-4 type-title">{t('setup.document.unavailableTitle')}</h2>
          <p className="mt-3 max-w-2xl type-body text-muted-foreground">
            {props.message?.text ?? t('setup.document.unavailableDescription')}
          </p>
          <Button className="mt-8" onClick={props.retry} type="button">
            {t('setup.document.retry')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function SetupLoading() {
  const { t } = useTranslation('projects')
  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <Badge variant="secondary">{t('setup.document.preparing')}</Badge>
      <h2 className="mt-4 type-title">{t('setup.document.preparingTitle')}</h2>
      <p className="project-setup-shimmer mt-3 max-w-2xl type-body" role="status">
        {t('setup.document.preparingDescription')}
      </p>
      <div className="mt-10 space-y-3" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div
            className="h-16 animate-pulse rounded-xl border border-border/70 bg-muted/25"
            key={row}
          />
        ))}
      </div>
    </div>
  )
}
