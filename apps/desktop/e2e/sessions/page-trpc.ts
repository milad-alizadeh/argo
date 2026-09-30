import type { Page } from 'playwright-core'

type TrpcCall = {
  path: string
  type: 'query' | 'mutation'
  input?: unknown
}

type FeedEntry = { row: { shape: string; id?: string; calls?: { id: string }[]; label?: string } }

export type SessionFeedReading = {
  type: 'session.feed.reading'
  sessionId: string
  chainId: string
  state: string
  error: { code: string } | null
  entries: FeedEntry[]
}

export type SessionRow = {
  id: string
  title: { text: string; source: string } | null
  status: string
  posture: string | null
  archived: boolean
  updatedAt: string | null
  activity: {
    label: string
    kind: string
    open: boolean
    tool: string | null
    target: string | null
  } | null
}

export async function trpcCall<Data>(page: Page, call: TrpcCall): Promise<Data> {
  return page.evaluate(async (request) => {
    const id = Math.floor(Math.random() * 1_000_000_000)
    const response = await window.argo.trpc({
      id,
      path: request.path,
      type: request.type,
      input: request.input,
    })
    if ('error' in response) throw new Error(JSON.stringify(response.error))
    return response.result.data as Data
  }, call)
}

export async function selectedProjectId(page: Page): Promise<string> {
  const fromHash = await page.evaluate(() => {
    const match = window.location.hash.match(/\/projects\/([^/]+)/)
    return match?.[1] ?? null
  })
  if (fromHash !== null) return fromHash
  const projects = await trpcCall<{ id: string }[]>(page, { path: 'projectList', type: 'query' })
  const projectId = projects[0]?.id
  if (projectId === undefined) throw new Error('No Project is open.')
  return projectId
}

export async function sessionRows(
  page: Page,
  filter: 'active' | 'archived' | 'all' = 'active',
): Promise<SessionRow[]> {
  const projectId = await selectedProjectId(page)
  const list = await trpcCall<{ total: number; rows: SessionRow[] }>(page, {
    path: 'sessionList',
    type: 'query',
    input: { projectId, filter, limit: 100 },
  })
  return list.rows
}

export async function sessionFeed(page: Page, sessionId: string): Promise<SessionFeedReading> {
  return page.evaluate(async (sessionId) => {
    const id = Math.floor(Math.random() * 1_000_000_000)
    return await new Promise<SessionFeedReading>((resolve, reject) => {
      let unsubscribe = () => {}
      let reading: SessionFeedReading | null = null
      const timer = setTimeout(() => {
        unsubscribe()
        reject(new Error(`sessionFeed for ${sessionId} did not settle`))
      }, 10_000)
      const succeed = (value: SessionFeedReading) => {
        clearTimeout(timer)
        unsubscribe()
        resolve(value)
      }
      const remember = (data: SessionFeedReading & { kept?: number; tail?: FeedEntry[] }) => {
        if (data.type === 'session.feed.reading') return data
        if (reading === null || data.tail === undefined) return reading
        return {
          ...reading,
          state: data.state,
          error: data.error,
          type: 'session.feed.reading' as const,
          entries: [...reading.entries.slice(0, data.kept ?? 0), ...data.tail],
        }
      }
      const settle = () => {
        if (reading?.state === 'ready' || reading?.state === 'failed') succeed(reading)
      }
      const take = (message: {
        id: number
        type: string
        error?: unknown
        result?: { data: unknown }
      }) => {
        if (message.id !== id) return
        if (message.type === 'error') {
          clearTimeout(timer)
          unsubscribe()
          reject(message.error)
          return
        }
        if (message.type !== 'data' || message.result === undefined) return
        reading = remember(message.result.data as SessionFeedReading)
        settle()
      }
      void window.argo
        .trpcSubscribe(
          { id, path: 'sessionFeed', type: 'subscription', input: { sessionId, subagentId: null } },
          take,
        )
        .then((stop) => {
          unsubscribe = stop
        })
        .catch((error: unknown) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }, sessionId)
}

export function feedRows(reading: SessionFeedReading) {
  return reading.entries.flatMap((entry) => (entry.row.shape === 'activity' ? [] : [entry.row]))
}

export async function updateSession(
  page: Page,
  input: { sessionId: string; title?: string; archived?: boolean },
) {
  return trpcCall<SessionRow>(page, { path: 'sessionUpdate', type: 'mutation', input })
}
