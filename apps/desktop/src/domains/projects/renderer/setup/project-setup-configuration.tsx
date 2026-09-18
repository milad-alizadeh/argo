import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { json } from '@codemirror/legacy-modes/mode/javascript'
import { forceLinting, linter } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { FlaskConical, Save, X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import { Button } from '@/renderer/components/ui/button'
import type { ProjectSetupViewProps } from './project-setup-window'

const jsonLanguage = StreamLanguage.define({ ...json, tokenTable: { property: tags.propertyName } })
const jsonHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.string, color: 'var(--chart-2)' },
    { tag: tags.propertyName, color: 'var(--chart-3)' },
    { tag: [tags.number, tags.bool], color: 'var(--chart-4)' },
  ]),
)
const CONFIGURATION_EDITOR_ID = 'project-configuration'

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
    <div className="border-b border-border px-4 py-3">
      <h2 className="type-heading font-medium text-foreground">{t('setup.configurationLabel')}</h2>
      <p className="mt-0.5 type-meta text-muted-foreground">{status}</p>
    </div>
  )
}

function ConfigurationEditor({
  message,
  saving,
  source,
  testConfiguration,
  updateSource,
}: ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  const editor = useRef<ReactCodeMirrorRef>(null)
  const extensions = useMemo(
    () => [
      jsonLanguage,
      jsonHighlighting,
      linter(jsonDiagnostics(t('setup.invalidJson')), { delay: 0 }),
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
    test: t('setup.testing'),
  }
  const busyMessage = saving === null ? null : busyMessages[saving]
  return (
    <div className="relative min-h-0 flex-1 p-3">
      <CodeMirror
        basicSetup={{ foldGutter: false, highlightActiveLine: true, lineNumbers: true }}
        className="w-full overflow-hidden rounded-lg border border-input bg-background text-left text-foreground shadow-inner focus-within:ring-2 focus-within:ring-ring [&_.cm-activeLine]:bg-muted/60 [&_.cm-content]:min-h-96 [&_.cm-content]:py-4 [&_.cm-editor]:min-h-96 [&_.cm-gutters]:border-r [&_.cm-gutters]:border-input [&_.cm-gutters]:bg-muted/70 [&_.cm-scroller]:font-mono [&_.cm-scroller]:type-body"
        extensions={extensions}
        onChange={updateSource}
        ref={editor}
        value={source}
      />
      {message || busyMessage ? (
        <p
          aria-live="polite"
          className="pointer-events-none absolute bottom-6 left-6 rounded-md bg-background/90 px-2 py-1 type-meta text-muted-foreground shadow-sm"
          role="status"
        >
          {message ?? busyMessage}
        </p>
      ) : null}
      <Button
        className="absolute right-6 bottom-6 shadow-surface"
        disabled={saving !== null || !source}
        onClick={() => {
          const view = editor.current?.view
          if (view) forceLinting(view)
          void testConfiguration()
        }}
        type="button"
        variant="outline"
      >
        <FlaskConical aria-hidden="true" />
        {saving === 'test' ? t('setup.testing') : t('setup.test')}
      </Button>
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
      <Button disabled={saving !== null || !source} onClick={save} type="button">
        <Save aria-hidden="true" />
        {saving === 'save' ? t('setup.saving') : t('setup.save')}
      </Button>
    </footer>
  )
}

function jsonDiagnostics(message: string) {
  return (view: EditorView) => {
    try {
      JSON.parse(view.state.doc.toString())
      return []
    } catch (error) {
      const position = Number(/position (\d+)/.exec(String(error))?.[1] ?? 0)
      const from = Math.min(position, view.state.doc.length)
      return [
        {
          from,
          to: Math.min(from + 1, view.state.doc.length),
          severity: 'error' as const,
          message,
        },
      ]
    }
  }
}
