import type { SetupDocument } from './setup-document'

export type SetupAnswers = Readonly<Record<string, string | boolean>>

export function setupAnswers(document: SetupDocument, source: string): SetupAnswers {
  const configuration = parsedConfiguration(source) ?? document.configuration
  return Object.fromEntries(
    document.fields.flatMap((field) => {
      const configured = configurationValue(configuration, field.configurationPath)
      if (validAnswer(field, configured)) {
        return [[field.id, configured]]
      }
      const fallback = field.recommendation ?? field.value
      return fallback === undefined ? [] : [[field.id, fallback]]
    }),
  )
}

function validAnswer(
  field: SetupDocument['fields'][number],
  value: unknown,
): value is string | boolean {
  switch (field.type) {
    case 'text':
      return typeof value === 'string'
    case 'choice':
      return typeof value === 'string' && field.choices.some((choice) => choice.value === value)
    case 'boolean':
      return typeof value === 'boolean'
  }
}

export function setupConfiguration(
  document: SetupDocument,
  answers: SetupAnswers,
  source = '',
): string {
  const configuration = JSON.parse(
    JSON.stringify(parsedConfiguration(source) ?? document.configuration),
  ) as Record<string, unknown>
  for (const field of document.fields) {
    const answer = answers[field.id] ?? field.recommendation ?? field.value
    if (answer !== undefined) setConfigurationValue(configuration, field.configurationPath, answer)
  }
  return `${JSON.stringify(configuration, null, 2)}\n`
}

function setConfigurationValue(
  configuration: Record<string, unknown>,
  path: readonly string[],
  value: string | boolean,
) {
  let parent = configuration
  for (const segment of path.slice(0, -1)) {
    const child = parent[segment]
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      parent = child as Record<string, unknown>
    } else {
      const next: Record<string, unknown> = {}
      parent[segment] = next
      parent = next
    }
  }
  const key = path.at(-1)
  if (key !== undefined) parent[key] = value
}

function parsedConfiguration(source: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(source)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function configurationValue(configuration: Record<string, unknown>, path: readonly string[]) {
  let value: unknown = configuration
  for (const segment of path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}
