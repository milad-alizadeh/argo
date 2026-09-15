import path from 'node:path'
import process from 'node:process'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
} from '@/core/sessions/proof-protocol'

export function claudeTranscriptsRoot(home: string): string {
  return process.env[SESSION_CLAUDE_TRANSCRIPTS_ENV] ?? path.join(home, '.claude', 'projects')
}

// The user-level settings Argo adds its one `PreCompact` hook to (ADR-0041).
export function claudeSettingsPath(home: string): string {
  return path.join(home, '.claude', 'settings.json')
}

// Fixed under home rather than `userData`, so a dev instance and the app share one hook.
export function claudeCompactionMarkersRoot(home: string): string {
  return path.join(home, '.claude', 'argo-compactions')
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
