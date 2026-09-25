import { xcodeDarkInit, xcodeLightInit } from '@uiw/codemirror-theme-xcode'

export function xcodeEditorTheme(dark: boolean) {
  const createTheme = dark ? xcodeDarkInit : xcodeLightInit
  return createTheme({
    settings: {
      background: 'var(--popover)',
      gutterBackground: 'var(--popover)',
    },
  })
}
