// Where a Codex thread works. `session_meta` names the folder and branch it opened in, and a
// thread that moved into a worktree names that place only on each command it runs there.

import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript/transcript'
import { isRecord } from '@/shared/validation'

// `session_meta.git` is `{ commit_hash, branch, repository_url }`, absent outside a repository.
export function gitBranch(meta: Record<string, unknown>): string | null {
  const git = isRecord(meta.git) ? meta.git : null
  return git !== null && typeof git.branch === 'string' ? git.branch : null
}

// A completed `CommandExecution` item carries its cwd as a `file://` URL.
export function commandPlace(item: Record<string, unknown>): TranscriptRecord | null {
  if (typeof item.id !== 'string' || typeof item.cwd !== 'string') return null
  if (!item.cwd.startsWith('file://')) return null
  return { kind: 'trace', uuid: item.id, cwd: decodeURIComponent(new URL(item.cwd).pathname) }
}
