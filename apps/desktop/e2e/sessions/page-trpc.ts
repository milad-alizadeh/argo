import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { Page } from 'playwright-core'
import type { FeedReading, FeedReadingMessage } from '@/domains/sessions/api/feed'
import type { AppRouter } from '@/platform/main/trpc-router'

type RouterInputs = inferRouterInputs<AppRouter>
type RouterOutputs = inferRouterOutputs<AppRouter>

type TrpcCall = {
  path: string
  type: 'query' | 'mutation'
  input?: unknown
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
  const projects = await trpcCall<RouterOutputs['projectList']>(page, {
    path: 'projectList',
    type: 'query',
  })
  const projectId = projects[0]?.id
  if (projectId === undefined) throw new Error('No Project is open.')
  return projectId
}

export async function sessionRows(
  page: Page,
  filter: NonNullable<RouterInputs['sessionList']['filter']> = 'active',
): Promise<RouterOutputs['sessionList']['rows']> {
  const projectId = await selectedProjectId(page)
  const list = await trpcCall<RouterOutputs['sessionList']>(page, {
    path: 'sessionList',
    type: 'query',
    input: { projectId, filter, limit: 100 },
  })
  return list.rows
}

export async function sessionFeed(page: Page, sessionId: string): Promise<FeedReading> {
  return page.evaluate(async (sessionId) => {
    const id = Math.floor(Math.random() * 1_000_000_000)
    return await new Promise<FeedReading>((resolve, reject) => {
      let unsubscribe = () => {}
      let reading: FeedReading | null = null
      const timer = setTimeout(() => {
        unsubscribe()
        reject(new Error(`sessionFeed for ${sessionId} did not settle`))
      }, 10_000)
      const succeed = (value: FeedReading) => {
        clearTimeout(timer)
        unsubscribe()
        resolve(value)
      }
      const remember = (data: FeedReadingMessage): FeedReading | null => {
        if (data.type === 'session.feed.reading') return data
        if (reading === null) return reading
        return {
          ...reading,
          state: data.state,
          error: data.error,
          hasOlder: data.hasOlder,
          entries: [...data.head, ...reading.entries.slice(0, data.kept), ...data.tail],
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
        reading = remember(message.result.data as FeedReadingMessage)
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

export function feedRows(reading: FeedReading) {
  return reading.entries.flatMap((entry) => (entry.row.shape === 'activity' ? [] : [entry.row]))
}

export async function sessionDetails(page: Page, sessionId: string) {
  return trpcCall<RouterOutputs['sessionDetails']>(page, {
    path: 'sessionDetails',
    type: 'query',
    input: { sessionId },
  })
}

export async function sendSessionUpdate(page: Page, input: RouterInputs['sessionUpdate']) {
  return trpcCall<RouterOutputs['sessionUpdate']>(page, {
    path: 'sessionUpdate',
    type: 'mutation',
    input,
  })
}
