import type { ExecuteFacts } from '@/domains/sessions/contract/model/transcript'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

// Claude's `Bash` call as the domain's `execute` Tool Call (CONTEXT.md L3 · Tool Call).
export function bashFacts(input: Record<string, unknown>): ExecuteFacts {
  const command = text(input.command)
  return {
    kind: 'execute',
    command: command?.trim().split('\n', 1).join('') ?? null,
    label: text(input.label) ?? text(input.description),
    text: command,
    background: input.run_in_background === true,
  }
}
