import { projectRosterRow } from '@/core/sessions/roster'
import { readSessionFiles } from './discover'

// A live channel needs the folder its last Turn ran in, read from the transcript itself: origin
// (whether Argo ever started this thread) does not decide whether Argo can resume it.
export async function codexResumeTarget(root: string, sessionId: string): Promise<{ cwd: string } | null> {
  const chain = await readSessionFiles(root, sessionId).catch(() => null)
  if (!chain) return null
  const { cwd } = projectRosterRow(chain, 'codex')
  return cwd === null ? null : { cwd }
}
