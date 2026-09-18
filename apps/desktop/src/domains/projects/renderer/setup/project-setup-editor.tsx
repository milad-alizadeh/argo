import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { json } from '@codemirror/legacy-modes/mode/javascript'
import { forceLinting, linter } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { FlaskConical } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button'
import { lastInputWasKeyboard } from '@/renderer/lib/input-modality'
import type { ProjectSetupViewProps } from './project-setup-window'

const jsonLanguage = StreamLanguage.define({ ...json, tokenTable: { property: tags.propertyName } })
const jsonHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.string, color: 'var(--color-terminal-green)' },
    { tag: tags.propertyName, color: 'var(--color-terminal-blue)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--color-terminal-magenta)' },
  ]),
)
const argoEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--selected)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--selected)',
    color: 'var(--foreground)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    borderRightColor: 'var(--border)',
    color: 'var(--muted-foreground)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selected)',
  },
})
const CONFIGURATION_EDITOR_ID = 'project-configuration'
const CONFIGURATION_ERROR_ID = 'project-configuration-error'

export function ConfigurationEditor({
  saving,
  source,
  testConfiguration,
  updateSource,
}: ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  const editor = useRef<ReactCodeMirrorRef>(null)
  const [showsKeyboardFocus, setShowsKeyboardFocus] = useState(false)
  const invalidSource = !isJson(source)
  const extensions = useMemo(
    () => [
      jsonLanguage,
      jsonHighlighting,
      linter(jsonDiagnostics(t('setup.invalidJson')), { delay: 0 }),
      EditorView.contentAttributes.of({
        'aria-label': t('setup.configurationLabel'),
        ...(invalidSource
          ? { 'aria-describedby': CONFIGURATION_ERROR_ID, 'aria-invalid': 'true' }
          : {}),
        id: CONFIGURATION_EDITOR_ID,
      }),
    ],
    [invalidSource, t],
  )
  const busyMessages = {
    cancel: t('setup.cancelling'),
    save: t('setup.saving'),
    test: t('setup.testing'),
  }
  const busyMessage = saving === null ? null : busyMessages[saving]
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="relative">
        <CodeMirror
          basicSetup={{ foldGutter: false, highlightActiveLine: true, lineNumbers: true }}
          className="w-full overflow-hidden rounded-lg border border-input text-left shadow-inner has-[[data-keyboard-focus=true]]:ring-2 has-[[data-keyboard-focus=true]]:ring-ring [&_.cm-content]:min-h-96 [&_.cm-content]:pt-4 [&_.cm-content]:pr-4 [&_.cm-content]:pb-14 [&_.cm-editor]:min-h-96 [&_.cm-scroller]:font-mono [&_.cm-scroller]:type-body"
          data-keyboard-focus={showsKeyboardFocus}
          extensions={extensions}
          onChange={updateSource}
          onBlur={() => setShowsKeyboardFocus(false)}
          onFocus={() => setShowsKeyboardFocus(lastInputWasKeyboard())}
          ref={editor}
          theme={argoEditorTheme}
          value={source}
        />
        <Button
          className="absolute right-3 bottom-3 shadow-surface"
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
      <ConfigurationMessage busyMessage={busyMessage} />
      {invalidSource ? (
        <p className="sr-only" id={CONFIGURATION_ERROR_ID}>
          {t('setup.invalidJson')}
        </p>
      ) : null}
    </div>
  )
}

function ConfigurationMessage({ busyMessage }: { busyMessage: string | null }) {
  return busyMessage ? (
    <p aria-live="polite" className="mt-3 type-meta text-muted-foreground" role="status">
      {busyMessage}
    </p>
  ) : null
}

export function isJson(source: string): boolean {
  try {
    JSON.parse(source)
    return true
  } catch {
    return false
  }
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
