// The per-section pass: flags the sections of a document that are long, history-heavy,
// code-heavy or negation-heavy. Returns refsIn so the history-density check shares one regex.
const refsIn = (text) => (text.match(/(^|[\s(])#\d{2,5}\b/g) ?? []).length
const codeIn = (text) => (text.match(/```[\s\S]*?```/g) ?? []).join('').length
const negationsIn = (text) =>
  (text.match(/\b(never|do not|don't|not a|no longer)\b/gi) ?? []).length

const sectionsOf = (text) =>
  text.split(/^(?=#{1,3} )/m).map((p) => ({
    heading: (p.match(/^#{1,3} (.*)$/m)?.[1] ?? '(preamble)').trim(),
    text: p,
  }))

const flagsFor = (text) => {
  const flags = []
  if (text.length > 1500) flags.push('long: runbook or reference to disclose?')
  if (refsIn(text) >= 3) flags.push(`${refsIn(text)} issue refs: history as justification?`)
  if (codeIn(text) > 300) flags.push('code block: a cache of the environment?')
  if (negationsIn(text) > 5) flags.push(`${negationsIn(text)} negations`)
  return flags
}

export function sectionFlags({ files, read, rel, row, section, kb }) {
  section(
    'Sections of always-on files and rules/ (flags: >1.5 KB, ≥3 issue refs, >300 B of code, >5 negations)',
  )
  for (const file of files) {
    for (const s of sectionsOf(read(file))) {
      const flags = flagsFor(s.text)
      if (flags.length)
        row(kb(s.text.length).padStart(9), `${rel(file)} › ${s.heading}`, flags.join('; '))
    }
  }
  return refsIn
}
