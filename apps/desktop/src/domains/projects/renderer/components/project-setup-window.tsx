import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Textarea } from '../../../components/ui/textarea'
import { useManualProjectSetup } from '../hooks/use-manual-project-setup'

export function ProjectSetupWindow({ project }: { project: ProjectSummary }) {
  const { t } = useTranslation('projects')
  const setup = useManualProjectSetup(project.id, {
    saved: t('setup.saved'),
    valid: t('setup.valid'),
    invalid: t('setup.invalid'),
  })
  return <ProjectSetupView project={project} {...setup} />
}

type ProjectSetupViewProps = {
  message: string | null
  saved: boolean
  saving: boolean
  source: string
  save: () => Promise<void>
  validate: () => Promise<void>
  setSaved: (saved: boolean) => void
  setSource: (source: string) => void
}

export function ProjectSetupView({
  project,
  message,
  saved,
  saving,
  source,
  save,
  validate,
  setSaved,
  setSource,
}: { project: ProjectSummary } & ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  return (
    <main
      aria-label={t('setup.label', { name: project.name })}
      className="flex h-full min-h-0 flex-col bg-background"
      data-component="ProjectSetupWindow"
    >
      <div className="drag-region h-(--size-chrome-bar) shrink-0" />
      <Empty className="justify-start overflow-y-auto py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('setup.title', { name: project.name })}</EmptyTitle>
          <EmptyDescription>{t('setup.description')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <label
            className="w-full text-left type-label font-medium"
            htmlFor="project-configuration"
          >
            {t('setup.configurationLabel')}
          </label>
          <Textarea
            aria-label={t('setup.configurationLabel')}
            className="min-h-72 font-mono text-sm"
            id="project-configuration"
            onChange={(event) => {
              setSource(event.target.value)
              setSaved(false)
            }}
            value={source}
          />
          {message ? <p role="status">{message}</p> : null}
          <Button disabled={saving || !source} onClick={save} type="button">
            {t('setup.save')}
          </Button>
          <Button disabled={saving || !saved} onClick={validate} type="button" variant="outline">
            {t('setup.validate')}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
