import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { argoHooksUnchanged, HARNESS_HOME_ENVS, isolateHarnessFolders } from './real-user-config'

const command = (harness: string, socket: string) =>
  `curl -s -m 1 --unix-socket '${socket}' --data-binary @- http://localhost/h/${harness} || true`
const ARGO = command('claude', '/tmp/x/hooks.sock')
const OTHER = command('claude', '/tmp/other/hooks.sock')
const settingsOf = (...commands: string[]) =>
  JSON.stringify({
    hooks: { Stop: commands.map((each) => ({ hooks: [{ type: 'command', command: each }] })) },
  })
const tomlOf = (...commands: string[]) =>
  `[hooks]\nStop = [${commands.map((each) => `{ hooks = [{ type = "command", command = ${JSON.stringify(each)} }] }`).join(', ')}]\n`

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

// Throwaway copies of both configs, each holding one socket-form Argo hook; never the real ones.
function configs() {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'argo-real-config-guard-'))
  folders.push(folder)
  const settings = path.join(folder, 'settings.json')
  const toml = path.join(folder, 'config.toml')
  writeFileSync(settings, settingsOf(ARGO))
  writeFileSync(toml, tomlOf(command('codex', '/tmp/x/hooks.sock')))
  return { folder, settings, toml, files: [settings, toml] }
}

test('an Argo hook added to a config fails the run', () => {
  const { settings, files } = configs()
  const teardown = argoHooksUnchanged(files)
  writeFileSync(settings, settingsOf(ARGO, OTHER))
  expect(teardown).toThrow(/Added: .*other\/hooks\.sock/)
})

test('an Argo hook removed from a config fails the run', () => {
  const { toml, files } = configs()
  const teardown = argoHooksUnchanged(files)
  writeFileSync(toml, tomlOf())
  expect(teardown).toThrow(/Removed: .*\/h\/codex/)
})

test('two Argo hooks swapped in a config fail the run, since trust can follow position', () => {
  const { settings, files } = configs()
  writeFileSync(settings, settingsOf(ARGO, OTHER))
  const teardown = argoHooksUnchanged(files)
  writeFileSync(settings, settingsOf(OTHER, ARGO))
  expect(teardown).toThrow(/Added: none\. Removed: none\. Order changed\./)
})

test('a hook that is not Argo added to a config passes', () => {
  const { settings, files } = configs()
  const teardown = argoHooksUnchanged(files)
  writeFileSync(settings, settingsOf(ARGO, 'say done'))
  expect(teardown).not.toThrow()
})

test('a config file missing before and after passes', () => {
  const { folder } = configs()
  const teardown = argoHooksUnchanged([path.join(folder, 'missing', 'settings.json')])
  expect(teardown).not.toThrow()
})

// A launch spreads the runner's environment, so this is what keeps the app off the real homes (#2974).
test('a shell that names the real Harness homes still gives the run empty throwaway ones', () => {
  const realHome = os.userInfo().homedir
  const shell = HARNESS_HOME_ENVS.map((name) => [name, process.env[name]] as const)
  for (const name of HARNESS_HOME_ENVS) process.env[name] = path.join(realHome, `.${name}`)
  const removeFolders = isolateHarnessFolders()
  try {
    for (const name of HARNESS_HOME_ENVS) {
      const home = process.env[name] ?? ''
      expect(home.startsWith(os.tmpdir())).toBe(true)
      expect(home.startsWith(realHome)).toBe(false)
      expect(readdirSync(home)).toEqual([])
    }
  } finally {
    removeFolders()
    for (const [name, value] of shell) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})
