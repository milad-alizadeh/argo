export function isManualProjectDetails(source: string): boolean {
  try {
    const value: unknown = JSON.parse(source)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const details = value as Record<string, unknown>
    return (
      details.version === 1 &&
      typeof details.targets === 'object' &&
      details.targets !== null &&
      !Array.isArray(details.targets)
    )
  } catch {
    return false
  }
}
