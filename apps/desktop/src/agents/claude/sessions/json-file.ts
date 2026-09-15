import { readFile } from 'node:fs/promises'

// A JSON file another program writes: missing, unreadable or half-written all read as nothing.
export async function readJsonFile(file: string): Promise<unknown> {
  const text = await readFile(file, 'utf8').catch(() => null)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
