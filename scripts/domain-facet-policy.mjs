const APPLICATION_ROOTS = {
  main: 'apps/desktop/src/main',
  preload: 'apps/desktop/src/preload',
  renderer: 'apps/desktop/src/renderer/main',
}

export const ALLOWED_TARGETS = {
  shared: new Set(['shared']),
  contract: new Set(['contract', 'shared']),
  main: new Set(['contract', 'main', 'shared']),
  preload: new Set(['contract', 'preload', 'shared']),
  renderer: new Set(['contract', 'renderer', 'shared']),
  harness: new Set(['contract', 'shared']),
}

// The only top-level homes under src/; anything else is a legacy root.
export const SOURCE_ROOTS = new Set([
  'domains',
  'harnesses',
  'platform',
  'providers',
  'renderer',
  'shared',
])

export const FACETS = new Set(Object.keys(ALLOWED_TARGETS))
export const TARGET_FACETS = new Set([...FACETS, 'shared'])

export const COMPOSITION_ROOTS = new Set([
  APPLICATION_ROOTS.main,
  APPLICATION_ROOTS.preload,
  APPLICATION_ROOTS.renderer,
])

export const FACET_POLICIES = {
  shared: {
    refusesNode: true,
    refusesElectron: true,
    refusesReact: true,
    privilegedRoots: [
      APPLICATION_ROOTS.main,
      APPLICATION_ROOTS.preload,
      'apps/desktop/src/platform/main',
      'apps/desktop/src/platform/preload',
      'apps/desktop/src/platform/renderer',
      'apps/desktop/src/providers',
      'apps/desktop/src/renderer',
    ],
  },
  contract: {
    refusesNode: true,
    refusesElectron: true,
    refusesReact: true,
    privilegedRoots: [
      APPLICATION_ROOTS.main,
      APPLICATION_ROOTS.preload,
      'apps/desktop/src/platform/main/storage',
      'apps/desktop/src/providers',
      'apps/desktop/src/renderer',
    ],
  },
  main: {
    refusesNode: false,
    refusesElectron: false,
    refusesReact: false,
    privilegedRoots: [],
  },
  preload: {
    refusesNode: false,
    refusesElectron: false,
    refusesReact: false,
    privilegedRoots: [],
  },
  renderer: {
    refusesNode: true,
    refusesElectron: true,
    refusesReact: false,
    privilegedRoots: [
      APPLICATION_ROOTS.main,
      APPLICATION_ROOTS.preload,
      'apps/desktop/src/platform/main/storage',
      'apps/desktop/src/providers',
    ],
  },
  harness: {
    refusesNode: false,
    refusesElectron: false,
    refusesReact: false,
    privilegedRoots: [],
  },
}
