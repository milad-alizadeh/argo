const APPLICATION_ROOTS = {
  main: 'apps/desktop/src/main',
  preload: 'apps/desktop/src/preload',
  renderer: 'apps/desktop/src/renderer/main',
}

export const ALLOWED_TARGETS = {
  contract: new Set(['contract']),
  main: new Set(['contract', 'main']),
  preload: new Set(['contract', 'preload']),
  renderer: new Set(['contract', 'renderer']),
}

export const FACETS = new Set(Object.keys(ALLOWED_TARGETS))

export const COMPOSITION_ROOTS = new Set([
  APPLICATION_ROOTS.main,
  APPLICATION_ROOTS.preload,
  APPLICATION_ROOTS.renderer,
])

export const FACET_POLICIES = {
  contract: {
    refusesNode: true,
    refusesElectron: true,
    refusesReact: true,
    refusesLegacyCoreImplementation: true,
    privilegedRoots: [
      APPLICATION_ROOTS.main,
      APPLICATION_ROOTS.preload,
      'apps/desktop/src/core/storage',
      'apps/desktop/src/providers',
      'apps/desktop/src/renderer',
    ],
  },
  main: {
    refusesNode: false,
    refusesElectron: false,
    refusesReact: false,
    refusesLegacyCoreImplementation: false,
    privilegedRoots: [],
  },
  preload: {
    refusesNode: false,
    refusesElectron: false,
    refusesReact: false,
    refusesLegacyCoreImplementation: false,
    privilegedRoots: [],
  },
  renderer: {
    refusesNode: true,
    refusesElectron: true,
    refusesReact: false,
    refusesLegacyCoreImplementation: true,
    privilegedRoots: [
      APPLICATION_ROOTS.main,
      APPLICATION_ROOTS.preload,
      'apps/desktop/src/core/storage',
      'apps/desktop/src/providers',
    ],
  },
}
