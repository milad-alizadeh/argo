import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'

// Forge owns the whole desktop lifecycle: start, native rebuild, package, make, sign, publish.
// Decision: "Choose the Electron desktop toolchain" (#1732). Every @electron-forge/* package and
// Electron itself are pinned exactly, because Forge marks the Vite plugin experimental and
// reserves breaking changes for a minor release.

// What goes INTO the package. This list exists because the Vite plugin's default is
// `(file) => !file.startsWith('/.vite')` — it copies the Vite output and nothing else, on the
// assumption that Vite bundled every dependency into it. A native module cannot be bundled, so
// under that default `node-pty` never reaches the packaged app: Forge exits 0 and the app dies
// on its first require (#1743). The plugin defers to an `ignore` function we supply, so this is
// the supported way to keep one. Forge prunes dev dependencies out of node_modules itself, so
// keeping the whole tree is the ordinary Electron shape, not a size regression.
const KEPT_IN_PACKAGE = [/^\/\.vite($|\/)/, /^\/node_modules($|\/)/]

const config: ForgeConfig = {
  packagerConfig: {
    // ASAR is required by the two integrity fuses below.
    asar: true,
    name: 'Argo',
    appBundleId: 'tech.trili.argo.desktop',
    icon: 'assets/icon',
    ignore: (file) => (file ? !KEPT_IN_PACKAGE.some((kept) => kept.test(file)) : false),
  },
  // Forge runs @electron/rebuild here, which is what rebuilds node-pty against Electron's ABI.
  rebuildConfig: {},
  makers: [new MakerZIP({}, ['darwin']), new MakerDMG({})],
  plugins: [
    // Adds native modules to the ASAR unpack list, so node-pty's .node binary stays on disk.
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // Both targets emit into .vite/build, and the output is named after the entry file. Two
      // entries both called index.ts silently overwrite each other, so the entry basenames are
      // the contract with `main` in package.json and the preload path in src/main.ts.
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
    }),
    // Production hardening. The E2E package flavor is the only one that may re-enable
    // EnableNodeCliInspectArguments, because Playwright's Electron launcher can time out
    // without it; production gets a separate launch smoke instead.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
