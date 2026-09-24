import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { type ElectronApplication, _electron as electron } from 'playwright-core'
import { PROJECT_PROOF_STORE_ENV } from '@/domains/projects/main/proof-protocol'
import { appExecutable } from '../packaged-app'
import { test } from '../packaged-proof'

async function launch(application: string, userData: string): Promise<ElectronApplication> {
  return electron.launch({
    executablePath: appExecutable(application),
    env: {
      ...process.env,
      [PROJECT_PROOF_STORE_ENV]: userData,
    },
    timeout: 30_000,
  })
}

async function launchSecondProcess(application: string, userData: string): Promise<void> {
  const child = spawn(appExecutable(application), [], {
    env: {
      ...process.env,
      [PROJECT_PROOF_STORE_ENV]: userData,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output: Buffer[] = []
  child.stderr.on('data', (chunk: Buffer) => output.push(chunk))
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`The second Argo launch did not exit. ${Buffer.concat(output)}`))
    }, 10_000)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code !== 0 || signal) {
        reject(new Error(`The second Argo launch exited with ${code ?? signal}.`))
        return
      }
      resolve()
    })
  })
}

test('focuses the existing window when Argo launches a second time', async ({
  packagedApplication,
  root,
}) => {
  const userData = path.join(root, 'single-instance-user-data')
  await mkdir(userData, { recursive: true })
  const application = await launch(packagedApplication, userData)
  try {
    const page = await application.firstWindow()
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window?.show()
      window?.focus()
      window?.hide()
    })
    assert.equal(
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1,
    )

    await launchSecondProcess(packagedApplication, userData)

    await page.waitForFunction(() => document.visibilityState === 'visible')
    assert.equal(
      await application.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows()
        return {
          count: windows.length,
          focused: windows[0]?.isFocused() ?? false,
          visible: windows[0]?.isVisible() ?? false,
        }
      }),
      { count: 1, focused: true, visible: true },
    )
  } finally {
    await application.close()
  }
})
