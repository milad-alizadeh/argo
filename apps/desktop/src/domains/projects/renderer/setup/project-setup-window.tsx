import { Save } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import type { SetupDocument } from '@/domains/projects/contract/setup-document'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { ConfigurationPanel } from './project-setup-configuration'
import { type ProjectSetupMessage, useProjectSetup } from './use-project-setup'

export function ProjectSetupWindow({ project }: { project: ProjectSummary }) {
  const { t } = useTranslation('projects')
  const messages = useMemo(
    () => ({
      valid: t('setup.valid'),
      invalid: t('setup.invalid'),
      invalidJson: t('setup.invalidJson'),
      invalidSetupDocument: t('setup.invalidSetupDocument'),
      saved: t('setup.saved'),
      setupNetworkUnavailable: t('setup.setupNetworkUnavailable'),
    }),
    [t],
  )
  const setup = useProjectSetup(project.id, messages)
  return <ProjectSetupView project={project} {...setup} />
}

export type ProjectSetupViewProps = {
  document: SetupDocument | null
  message: ProjectSetupMessage | null
  applyConfiguration: () => Promise<void>
  loading: boolean
  retry: () => void
  saving: 'apply' | 'test' | null
  source: string
  testConfiguration: () => Promise<void>
  updateSource: (source: string) => void
}

export function ProjectSetupView({
  project,
  document,
  message,
  applyConfiguration,
  loading,
  retry,
  saving,
  source,
  testConfiguration,
  updateSource,
}: { project: ProjectSummary } & ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  const { add } = useToastManager()
  const setup = {
    applyConfiguration,
    document,
    loading,
    message,
    retry,
    saving,
    source,
    testConfiguration,
    updateSource,
  }
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
      <ConfigurationPanel {...setup} />
    </section>
  )
}
