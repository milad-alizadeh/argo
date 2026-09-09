import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { ForgeConfig } from '@electron-forge/shared-types'
import { assertPackagedPty } from './scripts/assert-packaged-pty.mjs'
import { productionInstall } from './scripts/production-install.mjs'

// Forge owns the whole desktop lifecycle: start, package, make, sign, publish. Not the native
// rebuild — see `rebuildConfig` below, which turns it off. Decision: "Choose the Electron desktop
// toolchain" (#1732). Every @electron-forge/* package and Electron itself are pinned exactly,
// because Forge marks the Vite plugin experimental and reserves breaking changes for a minor
// release.

// What goes INTO the package. This list exists because the Vite plugin's default is
// `(file) => !file.startsWith('/.vite')` — it copies the Vite output and nothing else, on the
// assumption that Vite bundled every dependency into it. A native module cannot be bundled, so
// under that default `node-pty` never reaches the packaged app: Forge exits 0 and the app dies
// on its first require (#1743). The plugin defers to an `ignore` function we supply, so this is
// the supported way to keep one. Forge prunes dev dependencies out of node_modules itself, so
// keeping the whole tree is the ordinary Electron shape, not a size regression.
const KEPT_IN_PACKAGE = [/^\/\.vite($|\/)/, /^\/node_modules($|\/)/]

// Dropped back out of that. `node-pty` ships prebuilt binaries for every platform it supports, and
// on a macOS-only build the Windows ones are dead weight in every install and every full-download
// update. Measured on the pinned 1.2.0-beta.15: 26 MB installed, of which 23 MB is `prebuilds/`
// and 23 MB of THAT is win32-arm64 and win32-x64. #1791 chose node-pty over the compiled Bun
// helper on exactly this arithmetic, so carrying the Windows prebuilds would hand the cost
// straight back. The build inputs go with them: sources, vendored deps and the node-gyp
// scaffolding, none of which the app opens once the rebuild is off (see `rebuildConfig`).
//
// Both darwin prebuilds stay, at about 210 KB. Forge's `ignore` is asked about a file with no
// architecture in hand, so dropping the unused one would need this list to know something it
// cannot see, and 72 KB is not worth a rule that guesses.
const DROPPED_FROM_PACKAGE = [
  /^\/node_modules\/node-pty\/prebuilds\/(?!darwin-)/,
  /^\/node_modules\/node-pty\/(src|deps|third_party|scripts|bin|build)($|\/)/,
]

const APP_NAME = 'Argo'

// node-pty derives its `spawn-helper` path from the loaded `.node` and rewrites `app.asar` to
// `app.asar.unpacked` in it, so the helper has to be unpacked too. AutoUnpackNativesPlugin only
// knows about `**/*.node`, and `spawn-helper` has no extension: under the plugin alone the
// rewritten path points at a file that is not there, and every `pty.spawn` fails silently. This
// unpacks the whole module. `assert-packaged-pty.mjs` reads the result back off the package,
// because whether the plugin merges with this list or overwrites it is not a promise it makes.
const UNPACK_GLOB = '**/node_modules/node-pty/**'

const config: ForgeConfig = {
  packagerConfig: {
    // ASAR is required by the two integrity fuses below.
    asar: { unpack: UNPACK_GLOB },
    // The production install IS the pruning, so there is nothing left for Forge to prune. Leaving
    // `prune` on makes `flora-colossus` walk the dev tree to decide what to drop, and it then
    // fails outright on the dev packages `--omit=dev` never installed. Turning it off also
    // sidesteps the walker defect that made this whole shape necessary (flora-colossus#44,
    // forge#4188): nothing walks, so nothing walks wrongly. What ships is exactly what
    // `package-lock.json` names under `dependencies` — node-pty and node-addon-api, about 400 KB.
    prune: false,
    name: APP_NAME,
    appBundleId: 'tech.trili.argo.desktop',
    icon: 'assets/icon',
    ignore: (file) => {
      if (!file) return false
      if (!KEPT_IN_PACKAGE.some((kept) => kept.test(file))) return true
      return DROPPED_FROM_PACKAGE.some((dropped) => dropped.test(file))
    },
  },
  // Nothing to rebuild. `node-pty`'s prebuilt binaries are N-API, so they are ABI-stable across
  // Node and Electron releases and do not need recompiling per Electron upgrade — #1790 loaded
  // one and forked a PTY on Electron 44.2.0 with `@electron/rebuild` never invoked. Leaving the
  // rebuild on costs the whole node-gyp toolchain at package time and forces the module's C++
  // sources and vendored deps into the package to feed it, which is most of what
  // DROPPED_FROM_PACKAGE exists to remove. If a future dependency does need a rebuild, name it
  // here rather than turning this back on wholesale.
  rebuildConfig: { onlyModules: [] },
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
    // Production hardening. `scripts/prove-packaged-pty.mjs` launches the shipped binary with
    // these fuses exactly as a user gets them, so nothing here is relaxed for testing.
    new FusesPlugin({
      version: FuseVersion.V1,
      // The plugin computes this true for an unsigned darwin bundle and then shells out to
      // `codesign`, so a darwin arm64 package dies inside @electron/fuses on a machine that has
      // none. The ad-hoc re-signature only matters to an app that will be RUN, and the shipped one
      // is built on a Mac, so narrowing it to darwin costs the release nothing and lets CI's Linux
      // tier read the manifest off the architecture that ships (#1806). Our config is spread after
      // the plugin's computed value, so this wins.
      resetAdHocDarwinSignature: process.platform === 'darwin',
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    // Before Forge walks the dependencies. `flora-colossus` only understands an npm-shaped tree
    // and treats an absent one as "no dependencies", so without this Forge exits 0 and ships an
    // app with no PTY (#1791).
    prePackage: async () => {
      productionInstall()
    },
    // After the app is on disk and before anything signs, notarizes or zips it. Throwing here
    // fails `forge package`, which is every path to an artifact.
    postPackage: async (_config, { outputPaths }) => {
      await assertPackagedPty(outputPaths, APP_NAME)
    },
  },
}

export default config
