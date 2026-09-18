import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { json } from '@codemirror/legacy-modes/mode/javascript'
import { tags } from '@lezer/highlight'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { Settings } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { Button } from '@/renderer/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/renderer/components/ui/empty'
import { useManualProjectSetup } from './use-manual-project-setup'

const jsonLanguage = StreamLanguage.define({ ...json, tokenTable: { property: tags.propertyName } })
const jsonHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.string, color: 'var(--chart-2)' },
    { tag: [tags.number, tags.bool], color: 'var(--chart-4)' },
  ]),
)
const CONFIGURATION_EDITOR_ID = 'project-configuration'

export function ProjectSetupWindow({ project }: { project: ProjectSummary }) {
  const { t } = useTranslation('projects')
  const setup = useManualProjectSetup(project.id, {
    cancelled: t('setup.cancelled'),
    saved: t('setup.saved'),
    valid: t('setup.valid'),
    invalid: t('setup.invalid'),
  })
  return <ProjectSetupView project={project} {...setup} />
}

type ProjectSetupViewProps = {
  message: string | null
  cancel: () => Promise<void>
  saved: boolean
  saving: 'cancel' | 'save' | 'validate' | null
  source: string
  save: () => Promise<void>
  validate: () => Promise<void>
  setSaved: (saved: boolean) => void
  setSource: (source: string) => void
}

export function ProjectSetupView({
  project,
  message,
  cancel,
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
      jsonLanguage,
      jsonHighlighting,
      EditorView.contentAttributes.of({
        'aria-label': t('setup.configurationLabel'),
        id: CONFIGURATION_EDITOR_ID,
      }),
    ],
    [t],
  )
  const busyMessages = {
    cancel: t('setup.cancelling'),
    save: t('setup.saving'),
    validate: t('setup.validating'),
  }
  const busyMessage = saving === null ? null : busyMessages[saving]
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
            htmlFor={CONFIGURATION_EDITOR_ID}
          >
            {t('setup.configurationLabel')}
          </label>
          <CodeMirror
            basicSetup={{ foldGutter: false, highlightActiveLine: true, lineNumbers: true }}
            className="w-full overflow-hidden rounded-md border border-input bg-background text-left text-foreground focus-within:ring-2 focus-within:ring-ring [&_.cm-content]:min-h-72 [&_.cm-content]:py-3 [&_.cm-editor]:min-h-72 [&_.cm-gutters]:border-r [&_.cm-gutters]:border-input [&_.cm-gutters]:bg-muted [&_.cm-scroller]:font-mono [&_.cm-scroller]:type-body"
            extensions={editorExtensions}
            onChange={(nextSource) => {
              setSource(nextSource)
              setSaved(false)
            }}
            value={source}
          />
          {message || busyMessage ? (
            <p aria-live="polite" role="status">
              {message ?? busyMessage}
            </p>
          ) : null}
          <Button disabled={saving !== null || !source} onClick={save} type="button">
            {saving === 'save' ? t('setup.saving') : t('setup.save')}
          </Button>
          <Button
            disabled={saving !== null || !saved}
            onClick={validate}
            type="button"
            variant="outline"
          >
            {saving === 'validate' ? t('setup.validating') : t('setup.validate')}
          </Button>
          <Button disabled={saving !== null} onClick={cancel} type="button" variant="ghost">
            {saving === 'cancel' ? t('setup.cancelling') : t('setup.cancel')}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
