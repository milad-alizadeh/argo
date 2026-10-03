import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@uiw/react-codemirror'
import { codeSyntaxPalette } from '@/platform/renderer/components/xcode-code-theme'

const syntaxStyle = HighlightStyle.define([
  { tag: [tags.comment, tags.quote], color: codeSyntaxPalette.comment },
  { tag: tags.typeOperator, color: codeSyntaxPalette.keyword },
  { tag: tags.keyword, color: codeSyntaxPalette.keyword, fontWeight: 'bold' },
  { tag: [tags.string, tags.meta, tags.regexp, tags.link], color: codeSyntaxPalette.string },
  { tag: tags.name, color: codeSyntaxPalette.name },
  { tag: tags.typeName, color: codeSyntaxPalette.type },
  { tag: tags.variableName, color: codeSyntaxPalette.variable },
  { tag: tags.definition(tags.variableName), color: codeSyntaxPalette.definition },
])

export function xcodeEditorTheme(dark: boolean) {
  return [
    EditorView.theme(
      {
        '&': { backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' },
        '.cm-gutters': {
          backgroundColor: 'var(--popover)',
          color: 'var(--muted-foreground)',
          borderRightColor: 'var(--border)',
        },
        '.cm-content': { caretColor: 'var(--popover-foreground)' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--popover-foreground)' },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--muted)' },
        '.cm-activeLineGutter': { color: 'var(--popover-foreground)' },
        '&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
          {
            background: 'var(--accent) !important',
          },
        '.cm-selectionMatch': { backgroundColor: 'var(--accent)' },
      },
      { dark },
    ),
    syntaxHighlighting(syntaxStyle),
  ]
}
