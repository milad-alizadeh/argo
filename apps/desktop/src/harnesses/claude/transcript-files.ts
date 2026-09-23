import { readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { SESSION_CLAUDE_TRANSCRIPTS_ENV } from '@/domains/sessions/contract/proof-protocol'

export function claudeTranscriptsRoot(home: string): string {
  return process.env[SESSION_CLAUDE_TRANSCRIPTS_ENV] ?? path.join(home, '.claude', 'projects')
}

function sessionIdFromFileName(fileName: string) {
  return fileName.replace(/\.jsonl$/, '')
}

export async function transcriptPaths(
  root: string,
): Promise<{ path: string; sessionId: string }[]> {
  const directories = await readdir(root, { withFileTypes: true })
  const found: { path: string; sessionId: string }[] = []
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const inside = await readdir(path.join(root, directory.name)).catch(() => [])
    for (const name of inside) {
      if (name.endsWith('.jsonl')) {
        found.push({
          path: path.join(root, directory.name, name),
          sessionId: sessionIdFromFileName(name),
        })
      }
    }
  }
  return found
}
