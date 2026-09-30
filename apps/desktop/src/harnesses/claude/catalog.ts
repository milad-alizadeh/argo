import { execFile } from 'node:child_process'
import { type ModelInfo, type Query, query } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { type HarnessInfo, invalidCatalogResponse, unavailable } from '@/harnesses/harness-catalog'
import { claudeHarnessInfo } from './catalog-projection'

export type { ClaudeModelCatalog } from './catalog-projection'
export { claudeHarnessInfo, claudeModelCatalogSchema } from './catalog-projection'

export async function readClaudeHarnessInfo(executablePath: string | null): Promise<HarnessInfo> {
  if (executablePath === null) return unavailable('claude')
  try {
    const [models, permissionModes] = await Promise.all([
      readSupportedModels(executablePath),
      readSupportedPermissionModes(executablePath),
    ])
    return claudeHarnessInfo({ data: models, supportedPermissionModes: permissionModes })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidCatalogResponse('claude', error)
    if (error instanceof InvalidPermissionModesError)
      return {
        harness: 'claude',
        availability: 'unavailable',
        reason: 'invalid-response',
        detail: error.message,
      }
    return unavailable('claude')
  }
}

// SDK 0.3.278 initializes with models but does not list supported modes; ask the installed CLI.
function readSupportedPermissionModes(executablePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(executablePath, ['--help'], { encoding: 'utf8', timeout: 3_000 }, (error, stdout) => {
      if (error !== null) {
        reject(error)
        return
      }
      const modes = permissionModesFromHelp(stdout)
      if (modes.length === 0) {
        reject(new InvalidPermissionModesError())
        return
      }
      resolve(modes)
    })
  })
}

class InvalidPermissionModesError extends Error {
  constructor() {
    super('Claude help does not list permission modes.')
  }
}

export function permissionModesFromHelp(help: string): string[] {
  const section = help.split('--permission-mode <mode>')[1]?.split(/\n {2}--/)[0]
  const choices = section?.match(/\(choices:\s*([^)]*)\)/)?.[1]
  return choices === undefined
    ? []
    : [...choices.matchAll(/"([^"]+)"/g)].flatMap(([, mode]) => (mode ? [mode] : []))
}

async function readSupportedModels(executablePath: string): Promise<readonly ModelInfo[]> {
  const prompt = (async function* () {})()
  const session: Query = query({ prompt, options: { pathToClaudeCodeExecutable: executablePath } })
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const initialized = await Promise.race([
      session.initializationResult(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Claude model discovery timed out.')), 10_000)
      }),
    ])
    return initialized.models
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    session.close()
  }
}
