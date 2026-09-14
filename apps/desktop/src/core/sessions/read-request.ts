// What every Session read does before it reads: refuse a wire version this build does not speak,
// and turn a filesystem failure into the contract's own error name.
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
