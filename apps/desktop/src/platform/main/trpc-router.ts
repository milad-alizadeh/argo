import { initTRPC } from '@trpc/server'
import { type SessionRouterContext, sessionRouter } from '@/domains/sessions/main/session-router'

const t = initTRPC.context<SessionRouterContext>().create()

export const appRouter = t.router({ sessions: sessionRouter })

export type AppRouter = typeof appRouter
