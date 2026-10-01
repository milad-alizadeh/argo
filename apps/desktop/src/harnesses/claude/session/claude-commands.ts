// Before a Session is live, a CLI started without a prompt lists the commands the Session would have.
import os from 'node:os'
import { type Query, query } from '@anthropic-ai/claude-agent-sdk'
import {
  type ComposerCommand,
  readComposerCommands,
} from '@/domains/sessions/api/composer-commands'
import { claudeCliEnvironment } from '../cli-environment'

const LIST_TIMEOUT_MS = 10_000

// Without a folder, the home folder stands in, so only personal commands are listed.
export async function readClaudeCommands(input: {
  executable: string | null
  cwd: string | null
  reject: (shape: string) => void
}): Promise<ComposerCommand[]> {
  const session: Query = query({
    prompt: (async function* () {})(),
    options: {
      cwd: input.cwd ?? os.homedir(),
      env: claudeCliEnvironment(),
      ...(input.executable === null ? {} : { pathToClaudeCodeExecutable: input.executable }),
    },
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const commands = await Promise.race([
      session.supportedCommands(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Claude did not list its commands in time.')),
          LIST_TIMEOUT_MS,
        )
      }),
    ])
    return readComposerCommands(commands, input.reject)
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    session.close()
  }
}
