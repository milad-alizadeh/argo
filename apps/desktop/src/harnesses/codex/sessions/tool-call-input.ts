import { isRecord } from '@/shared/validation'

const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\x60((?:[^\x60\\]|\\.)*)\x60`
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r' }

function unescaped(literal: string) {
  return literal.replace(/\\(.)/g, (_, character: string) => ESCAPES[character] ?? character)
}

export function quotedAfter(value: string, lead: string): string | null {
  const match = value.match(new RegExp(String.raw`${lead}\s*(?:${QUOTED})`))
  const found = match?.[1] ?? match?.[2] ?? match?.[3] ?? null
  return found === null ? null : unescaped(found)
}

function writtenField(value: string, key: string): string | null {
  return quotedAfter(value, String.raw`["']?${key}["']?\s*:`)
}

function fieldVariable(value: string, key: string): string | null {
  return value.match(new RegExp(String.raw`["']?${key}["']?\s*:\s*([A-Za-z_$][\w$]*)`))?.[1] ?? null
}

function assignedString(value: string, name: string): string | null {
  return quotedAfter(value, String.raw`(?:const|let|var)\s+${name}\s*=`)
}

export function readToolCallInput(
  value: unknown,
  script = typeof value === 'string' ? value : '',
): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : { arguments: parsed }
  } catch {
    const cmd = writtenField(value, 'cmd')
    const workdir =
      writtenField(value, 'workdir') ??
      (() => {
        const name = fieldVariable(value, 'workdir')
        return name === null ? null : assignedString(script, name)
      })()
    const query = writtenField(value, 'q')
    const url = [writtenField(value, 'ref_id'), writtenField(value, 'url')].find(
      (found) => found?.startsWith('http') === true,
    )
    const path = writtenField(value, 'path')
    return {
      arguments: value,
      ...(cmd === null ? {} : { cmd }),
      ...(workdir === null ? {} : { workdir }),
      ...(path === null ? {} : { path }),
      ...(query === null ? {} : { query }),
      ...(url === undefined ? {} : { url }),
    }
  }
}
