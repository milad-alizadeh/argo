import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView } from '@uiw/react-codemirror'
import { xcodeCodePalette } from '@/renderer/components/ai-elements/xcode-code-theme'

export function xcodeEditorTheme(dark: boolean) {
  const palette = xcodeCodePalette[dark ? 'dark' : 'light']
  return [
    EditorView.theme(
      {
        '&': { backgroundColor: 'var(--popover)', color: palette.foreground },
        '.cm-activeLine': { backgroundColor: palette.lineHighlight },
        '.cm-activeLineGutter': { backgroundColor: palette.lineHighlight },
        ...(dark
          ? { '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--code-xcode-caret)' } }
          : {}),
        '.cm-gutters': {
          backgroundColor: 'var(--popover)',
          ...(!dark && palette.gutterForeground !== undefined
            ? { color: palette.gutterForeground }
            : {}),
        },
        '.cm-selectionMatch': { backgroundColor: palette.selection },
        '&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
          {
            background: `${palette.selection} !important`,
          },
      },
      { dark },
    ),
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: [tags.comment, tags.quote], color: palette.comment },
        ...(dark
          ? [{ tag: tags.keyword, color: palette.keyword, fontWeight: 'bold' }]
          : [
              { tag: [tags.typeName, tags.typeOperator], color: palette.keyword },
              { tag: tags.keyword, color: palette.keyword, fontWeight: 'bold' },
            ]),
        { tag: [tags.string, tags.meta], color: palette.string },
        { tag: tags.typeName, color: palette.type },
        { tag: tags.name, color: palette.name },
        { tag: tags.variableName, color: palette.variable },
        { tag: tags.definition(tags.variableName), color: palette.definition },
        { tag: [tags.regexp, tags.link], color: dark ? palette.string : 'var(--code-xcode-link)' },
      ]),
    ),
  ]
}
