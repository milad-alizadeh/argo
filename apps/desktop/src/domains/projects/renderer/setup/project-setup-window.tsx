import { Save } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { useToastManager } from '@/renderer/components/ui/toast'
import { ConfigurationPanel } from './project-setup-configuration'
import { type ManualSetupMessage, useManualProjectSetup } from './use-manual-project-setup'

export function ProjectSetupWindow({ project }: { project: ProjectSummary }) {
  const { t } = useTranslation('projects')
  const setup = useManualProjectSetup(project.id, {
    valid: t('setup.valid'),
    invalid: t('setup.invalid'),
    invalidJson: t('setup.invalidJson'),
    saved: t('setup.saved'),
  })
  return <ProjectSetupView project={project} {...setup} />
}

export type ProjectSetupViewProps = {
  message: ManualSetupMessage | null
  cancel: () => Promise<void>
  saved: boolean
  save: () => Promise<void>
  saving: 'cancel' | 'save' | 'test' | null
  source: string
  testConfiguration: () => Promise<void>
  updateSource: (source: string) => void
}

export function ProjectSetupView({
  project,
  message,
  cancel,
  saved,
  save,
  saving,
  source,
  testConfiguration,
  updateSource,
}: { project: ProjectSummary } & ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  const { add } = useToastManager()
  const setup = { message, cancel, saved, save, saving, source, testConfiguration, updateSource }
  useEffect(() => {
    if (!message) return
    add({ priority: 'high', title: message.text, type: message.tone })
  }, [add, message])
  return (
    <main
      aria-label={t('setup.label', { name: project.name })}
      className="flex h-full min-h-0 flex-col bg-background"
      data-component="ProjectSetupWindow"
    >
      <div className="drag-region h-(--size-chrome-bar) shrink-0" />
      <SetupWorkspace project={project} {...setup} />
    </main>
  )
}

function SetupWorkspace({
  project,
  ...setup
}: { project: ProjectSummary } & ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  return (
    <section className="mx-auto grid w-full max-w-7xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-y-auto px-6 py-8">
      <header className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-foreground">
          <Save aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="type-title font-heading text-foreground">
            {t('setup.title', { name: project.name })}
          </h1>
          <p className="mt-1 max-w-2xl type-body text-muted-foreground">{t('setup.description')}</p>
        </div>
      </header>
      <ConfigurationPanel project={project} {...setup} />
    </section>
  )
}
