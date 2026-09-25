import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import {
  accountChallengeSchema,
  accountConnectedSchema,
  accountErrorSchema,
  accountListedSchema,
  provider,
} from '@/domains/accounts/contract/contract'
import { identifierSchema } from '@/shared/validation'
import type { AccountAccess } from './access'
import { disconnect, dismissNotice, listed } from './listing'
import { createSignIn } from './sign-in'

const t = initTRPC.create()
const emptyInputSchema = z.undefined()
const listOutputSchema = z.union([accountListedSchema, accountErrorSchema])
const challengeOutputSchema = z.union([accountChallengeSchema, accountErrorSchema])
const connectedOutputSchema = z.union([accountConnectedSchema, accountErrorSchema])

export type AccountProcedureContext = {
  access: AccountAccess
  signIn: ReturnType<typeof createSignIn>
}

export function createAccountProcedureContext(access: AccountAccess): AccountProcedureContext {
  return { access, signIn: createSignIn(access) }
}

export function accountProcedures(context: AccountProcedureContext) {
  return {
    accountList: t.procedure
      .input(emptyInputSchema)
      .output(listOutputSchema)
      .query(() => listed(context.access, randomUUID())),
    accountConnect: t.procedure
      .input(z.strictObject({ provider }))
      .output(challengeOutputSchema)
      .mutation(({ input }) => context.signIn.connect(randomUUID(), input.provider)),
    accountVerify: t.procedure
      .input(emptyInputSchema)
      .output(challengeOutputSchema)
      .mutation(() => context.signIn.verify(randomUUID())),
    accountWait: t.procedure
      .input(emptyInputSchema)
      .output(connectedOutputSchema)
      .mutation(() => context.signIn.wait(randomUUID())),
    accountCancel: t.procedure
      .input(emptyInputSchema)
      .output(listOutputSchema)
      .mutation(() => context.signIn.cancel(randomUUID())),
    accountDisconnect: t.procedure
      .input(z.strictObject({ accountId: identifierSchema }))
      .output(listOutputSchema)
      .mutation(({ input }) => disconnect(context.access, randomUUID(), input.accountId)),
    accountDismissNotice: t.procedure
      .input(emptyInputSchema)
      .output(listOutputSchema)
      .mutation(() => dismissNotice(context.access, randomUUID())),
  }
}
