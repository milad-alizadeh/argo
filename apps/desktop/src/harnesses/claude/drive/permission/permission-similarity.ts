import type { ClaudePermission } from '@/domains/sessions/contract/ipc/contract'

const FILE_EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
// A chained or substituted command could run anything after its first word, so it matches itself.
const SHELL_CONTROL = /;|&&|\|\||\||`|\$\(/
const ENVIRONMENT_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const SUBCOMMAND = /^[a-z][\w-]*$/

function exact(permission: ClaudePermission) {
  return `${permission.toolName} exact ${JSON.stringify(permission.input)}`
}

function commandKey(command: string) {
  const words = command.trim().split(/\s+/)
  while (words.length > 0 && ENVIRONMENT_ASSIGNMENT.test(words[0] ?? '')) words.shift()
  const [program, second] = words
  if (program === undefined) return null
  return second !== undefined && SUBCOMMAND.test(second) ? `${program} ${second}` : program
}

function hostKey(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// What "Allow similar" remembers: edits to any file, a command by its program and subcommand, a
// fetch by its host, and any other tool by its name.
export function similarityKey(permission: ClaudePermission): string {
  const { input, toolName } = permission
  if (FILE_EDIT_TOOLS.has(toolName)) return 'file-edits'
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    const key = SHELL_CONTROL.test(command) ? null : commandKey(command)
    return key === null ? exact(permission) : `Bash ${key}`
  }
  if (toolName === 'WebFetch') {
    const host = typeof input.url === 'string' ? hostKey(input.url) : null
    return host === null ? exact(permission) : `WebFetch ${host}`
  }
  return toolName
}
