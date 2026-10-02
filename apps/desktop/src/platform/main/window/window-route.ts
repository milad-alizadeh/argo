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
const routeDocumentSchema = z.object({ route: z.string().regex(SESSIONS_ROUTE) })

function routePath(userData: string): string {
  return portablePath(userData, 'window-route.json')
}

// The saved route, its Session List when the Session left that Project, or undefined.
export async function readWindowRoute(
  userData: string,
  database: Database,
): Promise<string | undefined> {
  const read = await readDocument(routePath(userData))
  if (!read.ok) return undefined
  const parsed = routeDocumentSchema.safeParse(read.document)
  if (!parsed.success) {
    console.warn('Ignored an unrecognised saved window route.')
    return undefined
  }
  const [route, projectId, sessionId, query = ''] = SESSIONS_ROUTE.exec(parsed.data.route) ?? []
  if (route === undefined || projectId === undefined) return undefined
  if (!listProjects(database).some((item) => item.id === projectId)) return undefined
  if (sessionId === undefined || sessionId === 'new') return route
  if (sessionInProject(database, sessionId, projectId)) return route
  return `/projects/${projectId}/sessions${query}`
}

export function rememberWindowRoute(window: BrowserWindow, userData: string): void {
  const queue = createWriteQueue()
  window.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    // The route lives in the hash until #2972 moves the window to path routing.
    const route = new URL(url).hash.slice(1)
    if (isMainFrame && SESSIONS_ROUTE.test(route))
      void queue(() => writeDocument(routePath(userData), { route }))
  })
}
