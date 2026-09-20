// Shared fixture for the Claude adapter's bounded-window proofs (#2239): raw transcripts rather
// than the named fixture set, since these proofs need enough Sessions to cross ROSTER_PAGE_SIZE.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export async function claudeRoot(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-window-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

// Sessions named so the Nth-newest one is `s<N>`, spaced a minute apart so their mtimes never
// tie, the same convention the shared engine's own suite uses.
export async function writeManySessions(root: string, count: number) {
  const project = path.join(root, 'project-one')
  await mkdir(project, { recursive: true })
  const base = Date.parse('2026-09-13T12:00:00.000Z')
  for (let index = 0; index < count; index += 1) {
    const writtenAt = new Date(base - index * 60_000).toISOString()
    const file = path.join(project, `s${index}.jsonl`)
    await writeFile(
      file,
      `${JSON.stringify({
        type: 'assistant',
        uuid: `s${index}-a`,
        timestamp: writtenAt,
        cwd: '/proj',
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hi.' }],
        },
      })}\n`,
    )
    await utimes(file, new Date(writtenAt), new Date(writtenAt))
  }
}
