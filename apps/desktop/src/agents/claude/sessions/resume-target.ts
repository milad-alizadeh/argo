import type { ResumeTarget } from '../drive/drive-channel'
import { readSessionFiles } from './discover'
import { projectRosterRow } from './roster'

// ADR-0026: a resume continues the chain's latest link, in the folder that link last worked in.
export async function claudeResumeTarget(
  transcripts: string,
  sessionId: string,
): Promise<ResumeTarget | null> {
  const chain = await readSessionFiles(transcripts, sessionId).catch(() => null)
  const tip = chain?.files.at(-1)
  if (!chain || tip === undefined) return null
  const { cwd } = projectRosterRow(chain)
  return cwd === null ? null : { cwd, tipId: tip.sessionId }
}
