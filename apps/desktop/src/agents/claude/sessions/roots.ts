import path from 'node:path'
import process from 'node:process'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
} from '@/core/sessions/proof-protocol'

export function claudeTranscriptsRoot(home: string): string {
  return process.env[SESSION_CLAUDE_TRANSCRIPTS_ENV] ?? path.join(home, '.claude', 'projects')
}

// One file per running `claude` process, read for which Session it holds (`sessions/live-processes.ts`).
export function claudeProcessesRoot(home: string): string {
  return path.join(home, '.claude', 'sessions')
}

// The Claude desktop app's own store, read for its archive flag alone (`sessions/archive.ts`). It
// sits under the app's support folder, and a machine without that app has no folder there: the
// reading degrades to no archived Sessions rather than to a failure.
export function claudeArchiveRoot(home: string): string {
  return (
    process.env[SESSION_CLAUDE_ARCHIVE_ENV] ??
    path.join(home, 'Library', 'Application Support', 'Claude', 'claude-code-sessions')
  )
}
