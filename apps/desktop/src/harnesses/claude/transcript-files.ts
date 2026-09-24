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

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function readDirectoryIfPresent(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (isMissingPath(error)) return []
    throw error
  }
}

export async function transcriptPaths(
  root: string,
): Promise<{ path: string; sessionId: string }[]> {
  const directories = await readDirectoryIfPresent(root)
  const found: { path: string; sessionId: string }[] = []
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const inside = await readDirectoryIfPresent(path.join(root, directory.name))
    for (const entry of inside) {
      const name = entry.name
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
