import type { ThemeRegistration } from 'shiki/core'

type CodePalette = {
  background: string
  foreground: string
  gutterForeground?: string
  lineHighlight: string
  comment: string
  definition: string
  keyword: string
  name: string
  string: string
  type: string
  variable: string
  selection: string
}

const XCODE_LIGHT: CodePalette = {
  background: 'var(--code-xcode-background)',
  foreground: 'var(--code-xcode-foreground)',
  gutterForeground: 'var(--code-xcode-gutter-foreground)',
  lineHighlight: 'var(--code-xcode-line-highlight)',
  comment: 'var(--code-xcode-comment)',
  definition: 'var(--code-xcode-definition)',
  keyword: 'var(--code-xcode-keyword)',
  name: 'var(--code-xcode-name)',
  string: 'var(--code-xcode-string)',
  type: 'var(--code-xcode-type)',
  variable: 'var(--code-xcode-variable)',
  selection: 'var(--code-xcode-selection)',
}

const XCODE_DARK: CodePalette = {
  background: 'var(--code-xcode-background)',
  foreground: 'var(--code-xcode-foreground)',
  lineHighlight: 'var(--code-xcode-line-highlight)',
  comment: 'var(--code-xcode-comment)',
  definition: 'var(--code-xcode-definition)',
  keyword: 'var(--code-xcode-keyword)',
  name: 'var(--code-xcode-name)',
  string: 'var(--code-xcode-string)',
  type: 'var(--code-xcode-type)',
  variable: 'var(--code-xcode-variable)',
  selection: 'var(--code-xcode-selection)',
}

export const xcodeCodePalette = { light: XCODE_LIGHT, dark: XCODE_DARK } as const

export const xcodeCodeThemes: ThemeRegistration[] = [
  xcodeTheme('xcode-light', 'light', XCODE_LIGHT),
  xcodeTheme('xcode-dark', 'dark', XCODE_DARK),
]

function xcodeTheme(name: string, type: 'dark' | 'light', palette: CodePalette): ThemeRegistration {
  return {
    name,
    type,
    settings: [
      { settings: { background: palette.background, foreground: palette.foreground } },
      {
        scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
        settings: { foreground: palette.comment },
      },
      { scope: ['keyword', 'storage', 'storage.type'], settings: { foreground: palette.keyword } },
      { scope: ['string', 'constant.character'], settings: { foreground: palette.string } },
      { scope: ['entity.name.type', 'support.type'], settings: { foreground: palette.type } },
      {
        scope: ['entity.name.function', 'meta.definition.variable'],
        settings: { foreground: palette.definition },
      },
      { scope: ['entity.name', 'support.function'], settings: { foreground: palette.name } },
      { scope: ['variable', 'support.variable'], settings: { foreground: palette.variable } },
    ],
  }
}
