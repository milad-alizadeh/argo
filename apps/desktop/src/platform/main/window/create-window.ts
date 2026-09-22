import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, nativeTheme } from 'electron'
import { windowBackground } from '@/platform/contract/appearance'
import { WINDOW_MINIMUM_WIDTH } from '@/platform/contract/minimum-width'

export function createDesktopWindow(request: {
  buildDirectory: string
  rendererName: string
  developmentServerURL?: string
  title?: string
  show: boolean
  additionalArguments?: string[]
  attach: (window: BrowserWindow, rendererURL: string) => void
  loaded: (window: BrowserWindow) => void
}): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: WINDOW_MINIMUM_WIDTH,
    ...(request.title ? { title: request.title } : {}),
    show: request.show,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
    webPreferences: {
      ...(request.additionalArguments ? { additionalArguments: request.additionalArguments } : {}),
      preload: path.join(request.buildDirectory, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  if (request.title) {
    window.webContents.on('page-title-updated', (event) => event.preventDefault())
  }

  const rendererPath = path.join(
    request.buildDirectory,
    `../renderer/${request.rendererName}/index.html`,
  )
  const rendererURL = request.developmentServerURL ?? pathToFileURL(rendererPath).href
  request.attach(window, rendererURL)

  if (request.developmentServerURL) void window.loadURL(request.developmentServerURL)
  else void window.loadFile(rendererPath)

  window.webContents.once('did-finish-load', () => request.loaded(window))
  return window
}
