import { StreamLanguage } from '@codemirror/language'
import { json } from '@codemirror/legacy-modes/mode/javascript'
import { linter } from '@codemirror/lint'
import { tags } from '@lezer/highlight'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDarkAppearance } from '@/platform/renderer/appearance/hooks/use-appearance'
import { lastInputWasKeyboard } from '@/platform/renderer/lib/input-modality'
import { xcodeEditorTheme } from './project-setup-editor-theme'

const jsonLanguage = StreamLanguage.define({ ...json, tokenTable: { property: tags.propertyName } })
const CONFIGURATION_ERROR_ID = 'project-configuration-error'

export function ProjectSetupEditor({
  onChange,
  source,
}: {
  onChange: (source: string) => void
  source: string
}) {
  const { t } = useTranslation('projects')
  const dark = useDarkAppearance()
  const [showsKeyboardFocus, setShowsKeyboardFocus] = useState(false)
  const invalidSource = !isJson(source)
  const theme = useMemo(() => xcodeEditorTheme(dark), [dark])
  const extensions = useMemo(
    () => [
      jsonLanguage,
      linter(jsonDiagnostics(t('setup.invalidJson')), { delay: 0 }),
      EditorView.contentAttributes.of({
        'aria-label': t('setup.configurationLabel'),
        ...(invalidSource
          ? { 'aria-describedby': CONFIGURATION_ERROR_ID, 'aria-invalid': 'true' }
          : {}),
      }),
    ],
    [invalidSource, t],
  )
  return (
    <>
      <CodeMirror
        basicSetup={{ foldGutter: false, highlightActiveLine: true, lineNumbers: true }}
        className="w-full overflow-hidden rounded-lg border border-input text-left shadow-inner has-[[data-keyboard-focus=true]]:ring-2 has-[[data-keyboard-focus=true]]:ring-ring [&_.cm-content]:min-h-64 [&_.cm-content]:pt-4 [&_.cm-content]:pr-4 [&_.cm-content]:pb-4 [&_.cm-editor]:min-h-64 [&_.cm-scroller]:font-mono [&_.cm-scroller]:type-body"
        data-keyboard-focus={showsKeyboardFocus}
        extensions={extensions}
        onBlur={() => setShowsKeyboardFocus(false)}
        onChange={onChange}
        onFocus={() => setShowsKeyboardFocus(lastInputWasKeyboard())}
        theme={theme}
        value={source}
      />
      {invalidSource ? (
        <p className="sr-only" id={CONFIGURATION_ERROR_ID}>
          {t('setup.invalidJson')}
        </p>
      ) : null}
    </>
  )
}

function isJson(source: string): boolean {
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
