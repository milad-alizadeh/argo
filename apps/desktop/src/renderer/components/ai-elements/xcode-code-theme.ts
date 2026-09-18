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
  background: '#fff',
  foreground: '#3D3D3D',
  gutterForeground: '#AFAFAF',
  lineHighlight: '#d5e6ff69',
  comment: '#707F8D',
  definition: '#327A9E',
  keyword: '#aa0d91',
  name: '#032f62',
  string: '#D23423',
  type: '#522BB2',
  variable: '#23575C',
  selection: '#BBDFFF',
}

const XCODE_DARK: CodePalette = {
  background: '#292A30',
  foreground: '#CECFD0',
  lineHighlight: '#ffffff0f',
  comment: '#7F8C98',
  definition: '#6BDFFF',
  keyword: '#FF7AB2',
  name: '#6BAA9F',
  string: '#FF8170',
  type: '#DABAFF',
  variable: '#ACF2E4',
  selection: '#727377',
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
