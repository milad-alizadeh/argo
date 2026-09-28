// Which Argo a flow launches (#2844): the Vite build under the Electron in node_modules by default,
// or a fuse-flipped copy of the packaged app when CI sets ARGO_E2E_PACKAGED=1.
import { stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { appExecutable, packagedTestCopy } from './packaged-app'

// Paths resolve from the package script's working directory, because tools bundle this module.
export const packagedRun = process.env.ARGO_E2E_PACKAGED === '1'

// The packaged app, or the project directory whose `main` is the Vite build.
export async function applicationUnderTest(root: string): Promise<string> {
  if (packagedRun) return await packagedTestCopy(root)
  const main = path.join(process.cwd(), '.vite', 'build', 'main.js')
  await stat(main).catch(() => {
    throw new Error(`${main} is missing. Run \`bun run build:vite\` in apps/desktop first.`)
  })
  return process.cwd()
}

// What to run for one launch of `application`, with the app's own arguments after it.
export function launchCommand(application: string, args: string[] = []) {
  if (packagedRun) return { executablePath: appExecutable(application), args }
  const electron = createRequire(path.join(process.cwd(), 'package.json'))('electron') as string
  return { executablePath: electron, args: [application, ...args] }
}
