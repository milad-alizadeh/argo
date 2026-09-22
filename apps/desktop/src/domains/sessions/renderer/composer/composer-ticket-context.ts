import { z } from 'zod'

export type ComposerTicketContext = {
  id: string
  provider: 'github' | 'linear'
  key: string
  title: string
  status: string
  terminal: boolean
  blocked: boolean | null
}

export const ticketContextSchema = z.object({
  id: z.string(),
  provider: z.enum(['github', 'linear']),
  key: z.string(),
  title: z.string(),
  status: z.string(),
  terminal: z.boolean(),
  blocked: z.boolean().nullable(),
})
