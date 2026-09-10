import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourcePath = resolve('apps/desktop/src/renderer/tokens.css')
const browserMirrorPath = resolve('docs/designs/tokens.css')

await copyFile(sourcePath, browserMirrorPath)
console.log(`docs/designs/tokens.css <- ${sourcePath}`)
