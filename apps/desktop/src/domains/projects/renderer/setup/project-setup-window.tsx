import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { ProjectSetupScreen } from './project-setup-screen'
import { useProjectSetup } from './use-project-setup'

type ProjectSetupViewProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  project: ProjectSummary
  snapshot: ProjectSetupSnapshot
}

export function ProjectSetupWindow({ project }: { project: ProjectSummary }) {
  const setup = useProjectSetup(project.id)
  if (setup.loading || !setup.snapshot) return <main aria-busy="true" />
  return <ProjectSetupView project={project} snapshot={setup.snapshot} command={setup.command} />
}

export function ProjectSetupView({ command, project, snapshot }: ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  return (
    <main
      aria-label={t('setup.label', { name: project.name })}
      className="flex h-full flex-col p-8"
    >
      <h1 className="type-title font-heading">
        {t(`setup.actor.${snapshot.screen}.title`, { name: project.name })}
      </h1>
      <p className="mt-2 type-body text-muted-foreground">
        {t(`setup.actor.${snapshot.screen}.description`)}
      </p>
      <ProjectSetupScreen command={command} snapshot={snapshot} />
    </main>
  )
}
