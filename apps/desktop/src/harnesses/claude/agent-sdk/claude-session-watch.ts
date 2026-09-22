export function watchedChanges(changed: Set<() => void>) {
  return (listener: () => void) => {
    changed.add(listener)
    return () => changed.delete(listener)
  }
}
