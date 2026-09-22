// Electron itself, stood in for every test that imports a bridge: `nativeTheme` and `dialog` exist
// only inside a running Electron process. `mock.module` replaces the module for the whole test run
// and the last registration wins, so a stand-in carrying only what its own file needs breaks
// whichever file runs after it — a named import of a member this object lacks throws at resolution.
// One object, registered by all of them, is the reason that cannot happen.
export const electronStandIn = {
  nativeTheme: {
    themeSource: 'system' as 'system' | 'light' | 'dark',
    shouldUseDarkColors: false,
    on: () => undefined,
    off: () => undefined,
  },
  // Never called: no Session read opens the attachment chooser, and an untrusted frame is refused
  // before the Project bridge's folder chooser runs.
  dialog: {},
  net: { fetch: async () => new Response() },
}
