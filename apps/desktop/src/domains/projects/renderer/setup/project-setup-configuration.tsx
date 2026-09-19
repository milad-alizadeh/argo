import { Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { ConfigurationEditor, isJson } from '@/domains/projects/renderer/setup/project-setup-editor'
import { ProjectSetupSteps } from '@/domains/projects/renderer/setup/project-setup-steps'
import type { ProjectSetupViewProps } from '@/domains/projects/renderer/setup/project-setup-window'
import { Button } from '@/platform/renderer/components/ui/button'

export function ConfigurationPanel({
  project,
  ...props
}: { project: ProjectSummary } & ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  return (
    <div className="grid min-h-0 overflow-hidden rounded-xl border bg-card shadow-surface [--setup-project-rail:13rem] lg:grid-cols-[var(--setup-project-rail)_minmax(0,1fr)]">
      <aside className="border-b bg-muted/25 p-4 lg:border-r lg:border-b-0">
        <p className="px-2 pb-3 type-heading font-medium text-foreground">{project.name}</p>
        <p className="px-2 type-meta text-muted-foreground">{t('setup.sharedFile')}</p>
        <ProjectSetupSteps projectName={project.name} />
      </aside>
      <div className="flex min-h-0 flex-col">
        <ConfigurationHeader saved={props.saved} saving={props.saving} />
        <ConfigurationEditor {...props} />
        <ConfigurationActions
          cancel={props.cancel}
          save={props.save}
          saving={props.saving}
          source={props.source}
        />
      </div>
    </div>
  )
}

function ConfigurationHeader({ saved, saving }: Pick<ProjectSetupViewProps, 'saved' | 'saving'>) {
  const { t } = useTranslation('projects')
  let status = t('setup.unsaved')
  if (saved) status = t('setup.saved')
  if (saving === 'save') status = t('setup.saving')
  return (
    <div className="px-4 py-3">
      <h2 className="type-heading font-medium text-foreground">{t('setup.configurationLabel')}</h2>
      <p className="mt-0.5 type-meta text-muted-foreground">{status}</p>
    </div>
  )
}

function ConfigurationActions({
  cancel,
  save,
  saving,
  source,
}: Pick<ProjectSetupViewProps, 'cancel' | 'save' | 'saving' | 'source'>) {
  const { t } = useTranslation('projects')
  return (
    <footer className="mt-auto flex items-center justify-end gap-2 border-t bg-muted/15 px-4 py-3">
      <Button disabled={saving !== null} onClick={cancel} type="button" variant="ghost">
        <X aria-hidden="true" />
        {saving === 'cancel' ? t('setup.cancelling') : t('setup.cancel')}
      </Button>
      <Button disabled={saving !== null || !isJson(source)} onClick={save} type="button">
        <Save aria-hidden="true" />
        {saving === 'save' ? t('setup.saving') : t('setup.save')}
      </Button>
    </footer>
  )
}
