import type { SetupAdapter } from '../../../domains/projects/main/setup/setup-adapter'
import type { ClaudeTurnSetup } from '../../../domains/sessions/contract/contract'

type ClaudeSetupDriver = {
  start: (request: { cwd: string; prompt: string; setup: ClaudeTurnSetup }) => string
  send: (sessionId: string, request: { prompt: string; setup: ClaudeTurnSetup }) => Promise<void>
}

const SETUP_TURN: ClaudeTurnSetup = { model: 'sonnet', effort: 'medium', mode: 'manual' }

export function createClaudeSetupAdapter(
  driver: ClaudeSetupDriver,
  available: () => boolean,
): SetupAdapter {
  return {
    id: 'claude',
    available: async () => available(),
    start: async ({ worktreePath, document }) => {
      const sessionId = driver.start({
        cwd: worktreePath,
        prompt: setupGoal(),
        setup: SETUP_TURN,
      })
      await driver.send(sessionId, { prompt: setupPrompt(document), setup: SETUP_TURN })
      return { sessionId }
    },
  }
}

function setupGoal(): string {
  return '/goal Make this Project locally ready. Generate onboarding form data, show every setup step, request approval before new commands or file categories, and stop only after validation passes or Argo needs a decision.'
}

function setupPrompt(document: { revision: string }): string {
  return [
    'You are the Argo Setup agent for this Project.',
    `The reviewed Setup document revision is ${document.revision}.`,
    'Inspect the dedicated setup worktree and describe the proposed commands and file changes with their reasons.',
    'Use the Session Plan to record every proposed action before requesting approval.',
    'Do not run a command or change a file before Argo records approval for the reviewed plan.',
    'Do not include secrets in messages, commands, file content, or plans.',
  ].join('\n\n')
}
