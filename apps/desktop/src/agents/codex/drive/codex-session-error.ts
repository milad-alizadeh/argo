export class CodexSessionDriverError extends Error {
  constructor(readonly code: 'codex-cli-unavailable' | 'codex-launch-failed') {
    super(
      code === 'codex-cli-unavailable'
        ? 'Codex is not available. Run codex doctor to repair it.'
        : 'Argo could not start Codex.',
    )
  }
}
