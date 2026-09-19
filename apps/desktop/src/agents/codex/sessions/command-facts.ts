import type { ExecuteFacts, ToolCall } from '../../../domains/sessions/contract/transcript'

type Input = Record<string, unknown>

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

// The legacy `shell` call passes argv, usually `["bash", "-lc", "<script>"]`; the script is the command.
function argvCommand(value: unknown): string | null {
  if (!Array.isArray(value) || !value.every((part) => typeof part === 'string')) return null
  const [, flag, script] = value
  const shellScript = flag !== undefined && /^-\w*c$/.test(flag) ? script : value.join(' ')
  return text(shellScript)
}

// Every command shape Codex writes, keyed by its tool name: `exec_command` and `exec`, and the
// legacy `shell` (argv) and `shell_command` (string). `command` is what ran; `wrapper` is the
// script an `exec` call carries when no command could be lifted out of it.
const COMMANDS: Record<
  string,
  (input: Input) => { command: string | null; wrapper?: string | null }
> = {
  exec_command: (input) => ({ command: text(input.cmd) }),
  exec: (input) => ({ command: text(input.cmd), wrapper: text(input.input) }),
  shell: (input) => ({ command: argvCommand(input.command) }),
  shell_command: (input) => ({ command: text(input.command) }),
}

function firstLine(command: string | null): string | null {
  return command?.trim().split('\n', 1).join('') ?? null
}

export function withCommandFacts(call: ToolCall): ToolCall {
  const read = Object.hasOwn(COMMANDS, call.name) ? COMMANDS[call.name] : undefined
  if (read === undefined) return call
  const { command, wrapper = null } = read(call.input)
  const execute: ExecuteFacts = {
    kind: 'execute',
    command: firstLine(command),
    label: text(call.input.label) ?? text(call.input.description),
    text: command ?? wrapper,
    background: false,
  }
  return { ...call, execute }
}
