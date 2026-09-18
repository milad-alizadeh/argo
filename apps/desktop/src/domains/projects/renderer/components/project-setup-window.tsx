import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { tags } from '@lezer/highlight'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { Settings } from 'lucide-react'
import { useMemo } from 'react'
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
import { useManualProjectSetup } from '../hooks/use-manual-project-setup'

const tomlLanguage = StreamLanguage.define(toml)
const tomlHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.comment, color: 'var(--muted-foreground)' },
    { tag: tags.string, color: 'var(--chart-2)' },
    { tag: [tags.number, tags.bool], color: 'var(--chart-4)' },
  ]),
)

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
  const editorExtensions = useMemo(
    () => [
      tomlLanguage,
      tomlHighlighting,
      EditorView.contentAttributes.of({ 'aria-label': t('setup.configurationLabel') }),
    ],
    [t],
  )
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
          <CodeMirror
            basicSetup={{ foldGutter: false, highlightActiveLine: true, lineNumbers: true }}
            className="w-full overflow-hidden rounded-md border border-input bg-background text-foreground focus-within:ring-2 focus-within:ring-ring [&_.cm-content]:min-h-72 [&_.cm-content]:py-3 [&_.cm-editor]:min-h-72 [&_.cm-gutters]:border-r [&_.cm-gutters]:border-input [&_.cm-gutters]:bg-muted [&_.cm-scroller]:font-mono [&_.cm-scroller]:text-sm"
            extensions={editorExtensions}
            onChange={(nextSource) => {
              setSource(nextSource)
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
