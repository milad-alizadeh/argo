// The window reopens on the Sessions route it last showed, so a restart keeps the selected Session.
import { eq } from 'drizzle-orm'
import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import {
  createWriteQueue,
  portablePath,
  readDocument,
  writeDocument,
} from '../storage/portable-file'

// A saved Session or the Session List alone, never an unsaved draft's `optimistic:` id.
const SESSIONS_ROUTE = /^\/projects\/([^/?#]+)\/sessions(?:\/[^/?#:]+)?(?:\?[^#]*)?$/
const routeDocumentSchema = z.object({ route: z.string().regex(SESSIONS_ROUTE) })

function routePath(userData: string): string {
  return portablePath(userData, 'window-route.json')
}

// The saved route, or undefined when it is missing, malformed or names a Project no longer listed.
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
  const projectId = SESSIONS_ROUTE.exec(parsed.data.route)?.[1]
  if (projectId === undefined) return undefined
  const listed = database.select({ id: project.id }).from(project).where(eq(project.id, projectId))
  return listed.get() === undefined ? undefined : parsed.data.route
}

export function rememberWindowRoute(window: BrowserWindow, userData: string): void {
  const queue = createWriteQueue()
  window.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    const route = new URL(url).hash.slice(1)
    if (isMainFrame && SESSIONS_ROUTE.test(route))
      void queue(() => writeDocument(routePath(userData), { route }))
  })
}
