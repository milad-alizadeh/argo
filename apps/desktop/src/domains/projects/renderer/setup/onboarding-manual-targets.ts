import type { OnboardingTarget } from './onboarding-model'

export function targetsFromManualSource(source: string): OnboardingTarget[] | null {
  try {
    const parsed: unknown = JSON.parse(source)
    if (!isRecord(parsed) || !isRecord(parsed.targets)) return null
    const configured = Object.entries(parsed.targets).map(([id, value]) =>
      targetFromManualValue(id, value),
    )
    return configured.every((target) => target !== null) ? (configured as OnboardingTarget[]) : null
  } catch {
    return null
  }
}

function targetFromManualValue(id: string, value: unknown): OnboardingTarget | null {
  if (!isRecord(value)) return null
  const { path, start, build, test } = value
  if (![path, start, build, test].every((item) => item === undefined || typeof item === 'string'))
    return null
  return {
    buildCommand: typeof build === 'string' ? build : '',
    existingTools: [],
    framework: 'not-inspected',
    id,
    name: id.replaceAll('-', ' '),
    packageManager: 'not-inspected',
    path: typeof path === 'string' ? path : '',
    recommendations: [],
    startCommand: typeof start === 'string' ? start : '',
    testCommand: typeof test === 'string' ? test : '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
