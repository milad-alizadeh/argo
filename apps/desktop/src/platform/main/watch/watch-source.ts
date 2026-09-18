// Something that can tell a topic its data may have changed, handing back its own disposer. A
// recursive tree watch is one (watch-paths.ts), a signal that says the app was blind for a while is
// another (watch-signals.ts), and a Permission in main-process memory is a third, touching no file.
// FSEvents can lose events with no error and no closed handle, for example across an unmount or a
// sleep, so a topic needs more than the tree behind it.
export type WatchedSource = (onChanged: () => void) => () => void
