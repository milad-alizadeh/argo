// The per-section pass: flags the sections of a document that are long, history-heavy,
// code-heavy or negation-heavy. Exports refsIn so the history-density check shares one regex.
import { kilobytes, read, row, section } from './report.mjs'

const LONG_SECTION_BYTES = 1500
const HISTORY_REFERENCES = 3
const CODE_BYTES = 300
const NEGATIONS = 5

export const refsIn = (text) => (text.match(/(^|[\s(])#\d{2,5}\b/g) ?? []).length
const codeIn = (text) => (text.match(/```[\s\S]*?```/g) ?? []).join('').length
const negationsIn = (text) =>
  (text.match(/\b(never|do not|don't|not a|no longer)\b/gi) ?? []).length

const sectionsOf = (text) =>
  text.split(/^(?=#{1,3} )/m).map((part) => ({
    heading: (part.match(/^#{1,3} (.*)$/m)?.[1] ?? '(preamble)').trim(),
    text: part,
  }))

const flagsFor = (text) => {
  const flags = []
  if (text.length > LONG_SECTION_BYTES) flags.push('long: runbook or reference to disclose?')
  if (refsIn(text) >= HISTORY_REFERENCES)
    flags.push(`${refsIn(text)} issue refs: history as justification?`)
  if (codeIn(text) > CODE_BYTES) flags.push('code block: a cache of the environment?')
  if (negationsIn(text) > NEGATIONS) flags.push(`${negationsIn(text)} negations`)
  return flags
}

export function sectionFlags({ files, relative }) {
  section(
    `Sections of always-on files and rules/ (flags: >${kilobytes(LONG_SECTION_BYTES)}, ≥${HISTORY_REFERENCES} issue refs, >${CODE_BYTES} B of code, >${NEGATIONS} negations)`,
  )
  for (const file of files) {
    for (const part of sectionsOf(read(file))) {
      const flags = flagsFor(part.text)
      if (flags.length)
        row(
          kilobytes(part.text.length).padStart(9),
          `${relative(file)} › ${part.heading}`,
          flags.join('; '),
        )
    }
  }
}
