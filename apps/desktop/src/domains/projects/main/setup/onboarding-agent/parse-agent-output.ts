import type { z } from 'zod'

export type ParsedAgentOutput<Value> =
  | { kind: 'parsed'; value: Value }
  | { kind: 'invalid-output'; issues: string[] }

export function parseAgentOutput<Value>(
  payload: string,
  schema: z.ZodType<Value>,
  label: string,
): ParsedAgentOutput<Value> {
  const parsedJson = parseJson(payload, label)
  if (parsedJson.kind === 'invalid-output') return parsedJson
  const parsed = schema.safeParse(parsedJson.value)
  if (!parsed.success) {
    return { kind: 'invalid-output', issues: parsed.error.issues.map((issue) => issue.message) }
  }
  return { kind: 'parsed', value: parsed.data }
}

function parseJson(payload: string, label: string): ParsedAgentOutput<unknown> {
  try {
    return { kind: 'parsed', value: JSON.parse(payload) }
  } catch (error) {
    return {
      kind: 'invalid-output',
      issues: [`${label} output was not valid JSON: ${String(error)}`],
    }
  }
}
