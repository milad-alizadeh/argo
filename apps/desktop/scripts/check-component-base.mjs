// The CLI half of the shadcn base guard (#1767). It is an error, not a warning: the house rule
// gives a quality gate no warning tier.
import path from 'node:path'
import process from 'node:process'
import { checkComponentBase } from './component-base.mjs'

const root = path.resolve(import.meta.dirname, '..')
const { allowed, files, breaches } = await checkComponentBase(root)
if (breaches.length > 0) {
  for (const breach of breaches) {
    process.stderr.write(`${breach.file} imports ${breach.specifier}, not ${allowed}\n`)
  }
  process.stderr.write(
    `components.json chooses ${allowed}. Generate the component with shadcn rather than pasting one.\n`,
  )
  process.exit(1)
}
process.stdout.write(
  `shadcn primitive base ${allowed}: ${files} components import no other primitive library\n`,
)
