import { readSessionFiles } from '@/harnesses/codex/sessions/discovery/discover'

// A live channel needs the folder its last Turn ran in. Codex writes it only once, on the
// `session_meta` record every file opens with, and never again on the message records
// `readPlace` reads for every other Harness: the newest file's own `session_meta` names the folder
// its Turn ran in, so a chain of resumes still reads the current one.
function newestCwd(chain: { files: { records: { kind: string; cwd?: string | null }[] }[] }) {
  for (const file of [...chain.files].reverse()) {
    for (const record of file.records) {
      if (record.kind === 'trace' && typeof record.cwd === 'string') return record.cwd
    }
  }
  return null
}

export async function codexResumeTarget(
  root: string,
  sessionId: string,
): Promise<{ cwd: string } | null> {
  const chain = await readSessionFiles(root, sessionId).catch(() => null)
  if (!chain) return null
  const cwd = newestCwd(chain)
  return cwd === null ? null : { cwd }
}
