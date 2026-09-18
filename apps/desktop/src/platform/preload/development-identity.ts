import path from 'node:path'
import {
  DEVELOPMENT_IDENTITY_ARGUMENT_PREFIX,
  type DevelopmentIdentity,
  developmentIdentitySchema,
} from '../shared/development-identity'

export function developmentIdentityFromArguments(
  arguments_: readonly string[],
): DevelopmentIdentity | null {
  const argument = arguments_.find((value) =>
    value.startsWith(DEVELOPMENT_IDENTITY_ARGUMENT_PREFIX),
  )
  if (!argument) return null

  try {
    const value: unknown = JSON.parse(argument.slice(DEVELOPMENT_IDENTITY_ARGUMENT_PREFIX.length))
    const parsed = developmentIdentitySchema.safeParse(value)
    if (!parsed.success || !path.isAbsolute(parsed.data.worktree)) return null
    return parsed.data
  } catch {
    return null
  }
}
