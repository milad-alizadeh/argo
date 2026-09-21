import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { Button } from '@/platform/renderer/components/ui/button'
import { useProjectSetup } from './use-project-setup'

export function ProjectSetupWindow({ project }: { project: ProjectSummary }) {
  const setup = useProjectSetup(project.id)
  if (setup.loading || !setup.snapshot) return <main aria-busy="true" />
  return <ProjectSetupView project={project} snapshot={setup.snapshot} command={setup.command} />
}

export function ProjectSetupView({
  command,
  project,
  snapshot,
}: {
  command: (command: ProjectSetupCommand) => Promise<void>
  project: ProjectSummary
  snapshot: ProjectSetupSnapshot
}) {
  const { t } = useTranslation('projects')
  const [source, setSource] = useState(snapshot.manualSource)
  useEffect(() => setSource(snapshot.manualSource), [snapshot.manualSource])
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
      {snapshot.screen === 'choosing-method' ? (
        <div className="mt-6 flex gap-3">
          <Button onClick={() => void command({ type: 'choose-manual' })}>
            {t('setup.actor.manual.action')}
          </Button>
          <Button onClick={() => void command({ type: 'defer' })} variant="outline">
            {t('setup.actor.deferred.action')}
          </Button>
        </div>
      ) : null}
      {snapshot.screen === 'manual' ? (
        <div className="mt-6 grid gap-3">
          <textarea
            aria-label={t('setup.configurationLabel')}
            className="min-h-64 rounded-md border p-3 font-mono"
            onChange={(event) => setSource(event.target.value)}
            value={source}
          />
          <div className="flex gap-3">
            <Button onClick={() => void command({ type: 'save-manual', source })}>
              {t('setup.actor.manual.action')}
            </Button>
            <Button onClick={() => void command({ type: 'back' })} variant="outline">
              {t('setup.document.back')}
            </Button>
          </div>
        </div>
      ) : null}
      {snapshot.screen === 'deferred' ? (
        <Button className="mt-6 w-fit" onClick={() => void command({ type: 'resume-setup' })}>
          {t('setup.actor.deferred.action')}
        </Button>
      ) : null}
      {snapshot.screen === 'ready' ? (
        <Button
          className="mt-6 w-fit"
          onClick={() => void command({ type: 'start-repair-or-upgrade' })}
        >
          {t('setup.actor.ready.action')}
        </Button>
      ) : null}
    </main>
  )
}
