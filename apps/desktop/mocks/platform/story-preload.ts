const loads: Promise<unknown>[] = []

// Starts a lazy module load when its stories file is imported; a run awaits it in a hook, not in one story.
export function preloadForStories(load: () => Promise<unknown>) {
  const loading = load()
  loads.push(loading)
  return () => loading
}

export function storyPreloads() {
  return Promise.all(loads)
}
