// Something that can tell a topic its data may have changed. A recursive tree watch is one
// (watch-paths.ts), and so is a signal that says the app was blind for a while (watch-signals.ts).
// FSEvents can lose events with no error and no closed handle, for example across an unmount or a
// sleep, so a topic needs more than the tree behind it.
export type WatchedSource = (onChanged: () => void) => WatchedSubscription

export type WatchedSubscription = {
  close: () => void
}
