export function updateComposerEntries<T>(
  entries: Record<string, T[]>,
  composerKey: string,
  update: (current: T[]) => T[],
): Record<string, T[]> {
  const updated = update(entries[composerKey] ?? [])
  if (updated.length === 0) {
    const { [composerKey]: _replaced, ...others } = entries
    return others
  }
  return { ...entries, [composerKey]: updated }
}
