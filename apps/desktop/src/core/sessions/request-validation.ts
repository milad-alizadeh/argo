// Shared by every reader request handler (#2025): the version check and the error code an fs
// failure maps to. Split out so reader.ts and feed-handlers.ts both read it rather than copying.
import { isRecord } from '../../boundary'

export function versionFailure(value: unknown) {
  return isRecord(value) && typeof value.version === 'number' && value.version !== 1
}

export function readFailure(error: unknown) {
  if (isRecord(error) && (error.code === 'EACCES' || error.code === 'EPERM')) return 'access-denied'
  if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
    return 'transcripts-unavailable'
  }
  return 'internal-error'
}
