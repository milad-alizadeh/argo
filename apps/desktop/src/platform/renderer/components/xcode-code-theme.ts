import type { ThemeRegistration } from 'shiki/core'

type CodePalette = {
  background: string
  foreground: string
  comment: string
  definition: string
  keyword: string
  name: string
  string: string
  type: string
  variable: string
}

export const codeSyntaxPalette: CodePalette = {
  background: 'var(--card)',
  foreground: 'var(--card-foreground)',
  comment: 'var(--code-xcode-comment)',
  definition: 'var(--code-xcode-definition)',
  keyword: 'var(--code-xcode-keyword)',
  name: 'var(--code-xcode-name)',
  string: 'var(--code-xcode-string)',
  type: 'var(--code-xcode-type)',
  variable: 'var(--code-xcode-variable)',
}

export const xcodeCodeThemes: ThemeRegistration[] = [
  xcodeTheme('xcode-light', 'light', codeSyntaxPalette),
  xcodeTheme('xcode-dark', 'dark', codeSyntaxPalette),
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
