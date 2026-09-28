import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach } from 'vitest'

// Points CLAUDE_CONFIG_DIR at a fresh temp directory for one test's transcript-reading, and
// restores it after. Call once at the top of a test file; it wires its own beforeEach/afterEach.
export function claudeConfigDirFixture() {
  let configDir: string | undefined
  let previousConfigDir: string | undefined

  beforeEach(async () => {
    previousConfigDir = process.env.CLAUDE_CONFIG_DIR
    configDir = await mkdtemp(path.join(os.tmpdir(), 'claude-config-dir-'))
    process.env.CLAUDE_CONFIG_DIR = configDir
  })

  afterEach(async () => {
    process.env.CLAUDE_CONFIG_DIR = previousConfigDir
    if (configDir !== undefined) await rm(configDir, { recursive: true, force: true })
  })

  return {
    get dir(): string {
      if (configDir === undefined) throw new Error('claudeConfigDirFixture: no active test.')
      return configDir
    },
  }
}
