// The window reopens on the Sessions route it last showed, so a restart keeps the selected Session.
import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { listProjects } from '@/domains/projects/main/api'
import { sessionInProject } from '@/domains/sessions/main/api'
import {
  createWriteQueue,
  portablePath,
  readDocument,
  writeDocument,
} from '../storage/portable-file'

// The Session List, a Session, or `new`: a reopened draft is harmless, since SQLite keeps it.
const SESSIONS_ROUTE = /^\/projects\/([^/?#]+)\/sessions(?:\/([^/?#]+))?(\?[^#]*)?$/
const routeDocumentSchema = z.object({ route: z.string() })

export function windowRoutePath(userData: string): string {
  return portablePath(userData, 'window-route.json')
}

// The saved route, its Session List when the Session left that Project, or undefined.
export async function readWindowRoute(
  userData: string,
  database: Database,
): Promise<string | undefined> {
  const read = await readDocument(windowRoutePath(userData))
  if (!read.ok) {
    if (read.reason !== 'missing') console.warn(`Ignored a saved window route: ${read.reason}.`)
    return undefined
  }
  const parsed = routeDocumentSchema.safeParse(read.document)
  const match = parsed.success ? SESSIONS_ROUTE.exec(parsed.data.route) : null
  if (match === null) {
    console.warn('Ignored an unrecognised saved window route.')
    return undefined
  }
  const [savedRoute, projectId, sessionId, query = ''] = match
  if (projectId === undefined || !listProjects(database).some((item) => item.id === projectId))
    return undefined
  if (sessionId === undefined || sessionId === 'new') return savedRoute
  if (sessionInProject(database, sessionId, projectId)) return savedRoute
  return `/projects/${projectId}/sessions${query}`
}

export function rememberWindowRoute(window: BrowserWindow, userData: string): void {
  const queue = createWriteQueue()
  window.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    // The route lives in the hash until #2972 moves the window to path routing.
    if (!isMainFrame) return
    const route = new URL(url).hash.slice(1)
    if (SESSIONS_ROUTE.test(route))
      void queue(async () => {
        if (!(await writeDocument(windowRoutePath(userData), { route })))
          console.warn('Could not save the window route.')
      })
  })
}
