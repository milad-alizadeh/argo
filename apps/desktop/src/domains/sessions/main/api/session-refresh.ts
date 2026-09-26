import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()
const outputSchema = z.strictObject({ accepted: z.literal(true) })

export type SessionRefreshContext = {
  refreshSessionSync: () => void
}

export function sessionRefreshProcedure(context: SessionRefreshContext) {
  return t.procedure.output(outputSchema).mutation(() => {
    context.refreshSessionSync()
    return { accepted: true }
  })
}
