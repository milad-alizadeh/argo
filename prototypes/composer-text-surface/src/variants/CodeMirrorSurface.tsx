// PROTOTYPE — variant D. CodeMirror 6.
//
// A text editor rather than a document editor: the value IS a string, the inking is a decoration
// over ranges of that string, and the caret has an API that returns coordinates. Everything the
// composer needs is a first-class concept here; the cost is a large dependency built for code.

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import {
  placeholder as cmPlaceholder,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { intentOf } from '../shared/keys'
import { commandMark } from '../shared/menu'
import type { SurfaceHandle, SurfaceProps, VariantNote } from '../shared/surface'

export const codeMirrorNote: VariantNote = {
  key: 'D',
  name: 'CodeMirror 6',
  dependency: '@codemirror/{state,view,commands} — about 120 kB gzipped',
  free: [
    'The value is a string. No document model between the draft and the model.',
    'Decorations are ranges over that string — exactly the shape commandMark returns.',
    'coordsAtPos gives the caret rectangle outright: no mirror, no measurement.',
    'Its own scroller, line wrapping, IME, undo and accessibility, all long-settled.',
    'A keymap with real precedence, so the composer’s keys sit above the defaults by construction.',
  ],
  handWork: [
    'A view plugin recomputing one decoration per document change.',
    'A high-precedence keymap turning the intents into CodeMirror commands.',
    'The theme rewritten in CodeMirror’s own style object — it will not read the app’s CSS alone.',
    'Height clamped through the theme, since the editor wants to own its own scroller.',
  ],
  costs: [
    'The heaviest of the four, and built for code: gutters, folding, and language modes unused.',
    'Its own React-shaped hole — the editor is imperative, so the binding is hand-written.',
    'A composer that looks like a text editor if the theme is not fully overridden.',
    "Undo crosses the send boundary: setValue('') is an ordinary transaction, so ⌘Z after a\n     send brings the sent line back. Fixable with a transaction annotation; it is not free.",
  ],
}

const mark = Decoration.mark({ class: 'command-mark' })

function markDecorations(state: EditorState): DecorationSet {
  const at = commandMark(state.doc.toString())
  if (!at) return Decoration.none
  return Decoration.set([mark.range(at[0], at[1])])
}

const inkCommandMark = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = markDecorations(view.state)
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = markDecorations(update.state)
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

const composerTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text-primary)',
      backgroundColor: 'transparent',
      fontSize: 'var(--body-size)',
      fontFamily: 'var(--font-body)',
      maxHeight: 'var(--field-ceiling)',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': {
      padding: 0,
      lineHeight: 'var(--field-line-height)',
      caretColor: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
    },
    '.cm-line': { padding: 0 },
    '.cm-scroller': { fontFamily: 'var(--font-body)', lineHeight: 'var(--field-line-height)' },
    '.cm-placeholder': { color: 'var(--text-disabled)' },
    '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--ground-selected)',
    },
  },
  { dark: true },
)

export function CodeMirrorSurface({
  handle,
  placeholder,
  onChange,
  onIntent,
  onCaretRect,
  onAttach,
}: SurfaceProps & { handle: React.RefObject<SurfaceHandle | null> }) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // The host's callbacks read through a ref: the editor is built once, and its extensions would
  // otherwise close over the first render's props.
  const live = useRef({ onChange, onIntent, onCaretRect, onAttach })
  live.current = { onChange, onIntent, onCaretRect, onAttach }

  useEffect(() => {
    if (!host.current) return

    const report = (editor: EditorView) => {
      const at = editor.state.selection.main.head
      const coords = editor.coordsAtPos(at)
      live.current.onCaretRect(
        coords ? { left: coords.left, top: coords.top, bottom: coords.bottom } : null,
      )
    }

    const extensions: Extension[] = [
      history(),
      EditorView.lineWrapping,
      cmPlaceholder(placeholder),
      inkCommandMark,
      composerTheme,
      EditorView.contentAttributes.of({ 'aria-label': placeholder, spellcheck: 'false' }),
      // Ahead of every default binding, by precedence rather than by preventDefault.
      keymap.of([
        {
          any: (editor, event) => {
            const intent = intentOf(event)
            if (intent === 'pass') return false
            if (live.current.onIntent(intent)) return true
            if (intent === 'newline') {
              editor.dispatch(editor.state.replaceSelection('\n'))
              return true
            }
            return intent === 'submit'
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.domEventHandlers({
        paste: (event) => {
          const files = Array.from(event.clipboardData?.files ?? [])
          if (files.length === 0) return false
          event.preventDefault()
          live.current.onAttach(files.map((file) => file.name || 'pasted image'))
          return true
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          live.current.onChange(update.state.doc.toString(), update.state.selection.main.head)
          report(update.view)
        }
      }),
    ]

    const editor = new EditorView({
      state: EditorState.create({ extensions }),
      parent: host.current,
    })
    view.current = editor
    editor.focus()
    report(editor)

    handle.current = {
      setValue(text, caret) {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: text },
          selection: { anchor: caret },
        })
      },
      focus() {
        editor.focus()
      },
    }

    return () => {
      editor.destroy()
      view.current = null
    }
  }, [handle, placeholder])

  return <div className="field" ref={host} />
}
