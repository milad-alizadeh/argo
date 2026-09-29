import { access, constants } from 'node:fs/promises'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()
const statInputSchema = z.strictObject({ paths: z.array(z.string()) })
const chosenSchema = z.strictObject({ paths: z.array(z.string()) })
const stattedSchema = z.strictObject({
  files: z.array(z.strictObject({ path: z.string(), readable: z.boolean() })),
})

export type SessionAttachmentContext = {
  chooseAttachmentFiles: () => Promise<string[]>
}

async function isReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function statAttachmentPaths(paths: readonly string[]) {
  return {
    files: await Promise.all(
      paths.map(async (path) => ({ path, readable: await isReadable(path) })),
    ),
  }
}

export function sessionAttachmentProcedures(context: SessionAttachmentContext) {
  return {
    sessionAttachmentChoose: t.procedure.output(chosenSchema).mutation(async () => ({
      paths: await context.chooseAttachmentFiles(),
    })),
    sessionAttachmentStat: t.procedure
      .input(statInputSchema)
      .output(stattedSchema)
      .query(({ input }) => statAttachmentPaths(input.paths)),
  }
}
