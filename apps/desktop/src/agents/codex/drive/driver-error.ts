export class CodexSessionDriverError extends Error {
  constructor(readonly code: 'codex-cli-unavailable' | 'codex-launch-failed') {
    super(
      code === 'codex-cli-unavailable'
        ? 'Codex is not available. Run codex doctor to repair it.'
        : 'Argo could not start Codex.',
    )
  }
}

export function launchEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  return environment
}
