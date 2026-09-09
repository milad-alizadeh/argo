/**
 * Turns `results.json` into the tables the research doc quotes.
 *
 * It exists so no number in the write-up is hand-transcribed. Re-run it against a fresh
 * `results.json` and the doc's tables can be replaced wholesale; a figure that has drifted shows
 * up as a diff rather than as a claim nobody can check.
 *
 * Run: `bun report.ts`
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Sample } from './async-arms'
import type { Score } from './predict'

type Row = {
  id: string
  kind: string
  bytes: number
  lines: number
  nodes: number | null
  coldRenderMs: number | null
  renderMsLeast: number
  renderMsMedian: number
  measureMsLeast: number
  height: number
  containerHeight: number
  parseError: string | null
  htmlEscaped: boolean
}

type Results = {
  ranAt: string
  userAgent: string
  devicePixelRatio: number
  columnWidth: number
  repeats: number
  mined: number
  htmlEscaped: number
  unreadable: number
  real: Row[]
  synthetic: Row[]
  scores: Score[]
  samples: Sample[]
  failure: { threw: boolean; message: string; strayNodes: string[]; heightIfDrawn: number | null }
}

const results: Results = JSON.parse(
  readFileSync(join(new URL('.', import.meta.url).pathname, 'results.json'), 'utf8'),
)

const ms = (n: number | null): string =>
  n === null || Number.isNaN(n) ? '—' : `${n.toFixed(0)} ms`
const px = (n: number): string => `${n.toFixed(0)} px`

const rendered = results.real.filter((r) => !r.parseError)

/** How the mined source had to be treated before mermaid would take it, if at all. */
function provenance(row: Row): string {
  if (row.parseError) return ' (unreadable)'
  if (row.htmlEscaped) return ' (repaired)'
  return ''
}

console.log(`## Run\n`)
console.log(`- ${results.ranAt}, DPR ${results.devicePixelRatio}, ${results.repeats} repeats`)
console.log(`- ${results.userAgent}`)
console.log(
  `- ${results.mined} mined diagrams · ${results.htmlEscaped} HTML-escaped and repaired · ` +
    `${results.unreadable} unreadable by any route · ${rendered.length} timed\n`,
)

console.log(`## Real diagrams\n`)
console.log(`| id | kind | source | drawn height | cold | warm least | warm median | measure |`)
console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`)
for (const r of [...results.real].sort((a, b) => b.renderMsMedian - a.renderMsMedian)) {
  const note = provenance(r)
  console.log(
    `| \`${r.id}\`${note} | ${r.kind} | ${r.bytes} B / ${r.lines} lines | ${px(r.height)} | ` +
      `${ms(r.coldRenderMs)} | ${ms(r.renderMsLeast)} | ${ms(r.renderMsMedian)} | ${ms(r.measureMsLeast)} |`,
  )
}
const totalLeast = rendered.reduce((n, r) => n + r.renderMsLeast, 0)
const totalMedian = rendered.reduce((n, r) => n + r.renderMsMedian, 0)
const worst = rendered.reduce((a, b) => (a.renderMsMedian > b.renderMsMedian ? a : b))
console.log(
  `\n**Total for the set:** ${ms(totalLeast)} least, ${ms(totalMedian)} median. ` +
    `**Worst single diagram:** \`${worst.id}\` at ${ms(worst.renderMsMedian)}.\n`,
)

console.log(`## Scaling\n`)
console.log(`| shape | nodes | source | drawn height | least | median | ms per node |`)
console.log(`| --- | ---: | ---: | ---: | ---: | ---: | ---: |`)
for (const r of results.synthetic) {
  const nodes = r.nodes ?? 1
  console.log(
    `| ${r.id.split('-')[0]} | ${nodes} | ${r.bytes} B | ${px(r.height)} | ` +
      `${ms(r.renderMsLeast)} | ${ms(r.renderMsMedian)} | ${(r.renderMsLeast / nodes).toFixed(1)} |`,
  )
}

console.log(`\n## Source-only height predictor\n`)
console.log(`| id | kind | predicted | drawn | error |`)
console.log(`| --- | --- | ---: | ---: | ---: |`)
for (const s of results.scores) {
  const predicted = s.predicted === null ? 'no reader' : px(s.predicted)
  const error = s.error === null ? '—' : `${(s.error * 100).toFixed(0)}%`
  console.log(`| \`${s.id}\` | ${s.kind} | ${predicted} | ${px(s.actual)} | ${error} |`)
}
const errors = results.scores.map((s) => s.error).filter((e): e is number => e !== null)
if (errors.length) {
  const worstError = Math.max(...errors.map(Math.abs))
  console.log(`\n**Worst absolute error:** ${(worstError * 100).toFixed(0)}%.\n`)
}

console.log(`## The other async cases\n`)
console.log(`| case | cost | what happened to the height |`)
console.log(`| --- | ---: | --- |`)
for (const s of results.samples) {
  console.log(`| ${s.label} | ${ms(s.ms)} | ${s.note ?? ''} |`)
}

console.log(`\n## A diagram that cannot render\n`)
console.log(`- threw: ${results.failure.threw}`)
console.log(
  `- stray nodes left in the document: ${results.failure.strayNodes.join(', ') || 'none'}`,
)
console.log(`- height if drawn: ${results.failure.heightIfDrawn ?? 'nothing to draw'}`)
console.log(`- message: ${results.failure.message.split('\n')[0]}`)
