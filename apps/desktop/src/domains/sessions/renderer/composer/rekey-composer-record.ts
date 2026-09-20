export function rekeyComposerRecord<T>(
  record: Record<string, T>,
  from: string,
  to: string,
): Record<string, T> {
  const value = record[from]
  if (value === undefined || from === to) return record
  const { [from]: _moved, ...remaining } = record
  return { ...remaining, [to]: value }
}
