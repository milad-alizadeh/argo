import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

// How a Shell command stands. A foreground command is `running` until its result lands, and is
// then not read at all. A background one keeps its final state, because that result is what
// replaces the running row the reader was watching (#1582).
const SHELL_STATES = ['running', 'completed', 'failed', 'interrupted'] as const
const shellStateSchema = z.enum(SHELL_STATES)
export type ShellState = z.infer<typeof shellStateSchema>

// A shell command the Session ran: the first line of what it was asked to run, whether it was
// sent to the background, and where it stands. `command` is absent where the call carries none.
// A background command also names the file the Harness streams its output to, and the sentence the
// notification ended it with.
export const sessionShellCommandSchema = z.strictObject({
  id: identifierSchema,
  command: z.string().nullable(),
  label: z.string().nullable(),
  background: z.boolean(),
  state: shellStateSchema,
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  outputPath: z.string().nullable(),
  result: z.string().nullable(),
})
export type SessionShellCommand = z.infer<typeof sessionShellCommandSchema>
