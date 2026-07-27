/**
 * Run this before trusting any number — #203's precedent, and the stake is higher here.
 *
 * #222's whole case for replacing #199's marker check was that containment is GROUND TRUTH
 * rather than a proxy. Normalisation is the one thing that can quietly falsify that claim: a
 * normaliser that erodes meaning would rescue genuine paraphrases and report a containment
 * rate that is partly fiction. So the cases below come in two kinds, and the second kind
 * matters more:
 *
 *   MUST CONTAIN  — formatting-only differences. A failure here means the check is too strict
 *                   and the measured paraphrase rate is inflated.
 *   MUST NOT      — meaning-changing differences. A failure here means the check is BROKEN in
 *                   the direction that hides defects, which is the failure #199 spent a whole
 *                   ticket avoiding.
 */

import { checkSpan, normalise } from './containment'
import { parseRouterReply } from './spans'
import { parseVerdict } from './judges'

type Case = { readonly why: string; readonly source: string; readonly span: string; readonly want: boolean }

const CASES: readonly Case[] = [
  // ---------------------------------------------------------------- MUST CONTAIN (formatting)
  {
    why: 'bold stripped',
    source: 'The suite ran: **412 tests pass**, 3 fail in `uploadData.spec.ts`.',
    span: '412 tests pass, 3 fail in uploadData.spec.ts.',
    want: true,
  },
  {
    why: 'bullet + heading prefix stripped',
    source: '## Findings\n\n- The parser only handles UTF-8 input.',
    span: 'The parser only handles UTF-8 input.',
    want: true,
  },
  { why: 'curly quotes folded', source: 'It said “done” and stopped.', span: 'It said "done" and stopped.', want: true },
  { why: 'em dash folded', source: 'Three fail — all in one file.', span: 'Three fail - all in one file.', want: true },
  {
    why: 'wrapped source, single-line span',
    source: 'I did not touch\nthe STT adapter in this change.',
    span: 'I did not touch the STT adapter in this change.',
    want: true,
  },
  {
    why: 'table pipes become spaces',
    source: '| file | status |\n| auth.ts | only partial coverage |',
    span: 'auth.ts only partial coverage',
    want: true,
  },
  {
    why: 'markdown link label kept, URL dropped',
    source: 'See [the ADR](https://example.com/adr-7) — it cannot be reverted.',
    span: 'See the ADR - it cannot be reverted.',
    want: true,
  },

  // ------------------------------------------------- MUST NOT CONTAIN (meaning) — the real test
  {
    why: 'NEGATION DROPPED — #193\'s actual failure',
    source: 'I did not touch the STT adapter in this change.',
    span: 'I did touch the STT adapter in this change.',
    want: false,
  },
  {
    why: 'negation paraphrased away',
    source: 'I did not touch the STT adapter.',
    span: 'The STT adapter is untouched.',
    want: false,
  },
  {
    why: 'RESTRICTOR DROPPED',
    source: 'The parser only handles UTF-8 input.',
    span: 'The parser handles UTF-8 input.',
    want: false,
  },
  {
    why: 'HEDGE FLATTENED',
    source: 'This might fix the race.',
    span: 'This fixes the race.',
    want: false,
  },
  {
    why: 'CONDITIONAL DROPPED',
    source: 'If the cache is cold, the first call takes 4 seconds.',
    span: 'The first call takes 4 seconds.',
    want: false,
  },
  {
    why: 'tense changed — a claim about the world',
    source: 'The migration failed on staging.',
    span: 'The migration fails on staging.',
    want: false,
  },
  {
    why: 'number changed',
    source: '412 tests pass, 3 fail.',
    span: '412 tests pass, 2 fail.',
    want: false,
  },
  {
    why: 'contraction expanded — a real edit, not formatting',
    source: "It doesn't reproduce on main.",
    span: 'It does not reproduce on main.',
    want: false,
  },
  {
    why: 'identifier altered by one character',
    source: 'Failing in uploadData.spec.ts.',
    span: 'Failing in uploadDate.spec.ts.',
    want: false,
  },
  {
    why: 'sentence invented wholesale',
    source: 'The suite is green.',
    span: 'Everything is fine and no action is needed.',
    want: false,
  },
]

let failures = 0
console.log('containment cases')
for (const c of CASES) {
  const got = checkSpan(c.source, c.span).contained
  const ok = got === c.want
  if (!ok) failures++
  const kind = c.want ? 'contain' : 'REJECT '
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${kind}  ${c.why}`)
  if (!ok) {
    console.log(`         source: ${JSON.stringify(normalise(c.source))}`)
    console.log(`         span  : ${JSON.stringify(normalise(c.span))}`)
  }
}

console.log('\nprefix diagnostic')
{
  const v = checkSpan(
    'I copied eleven words of this sentence and then drifted into paraphrase.',
    'I copied eleven words of this sentence and then wandered off.',
  )
  const ok = !v.contained && v.matchedPrefixWords >= 9
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  mid-quote drift located at word ${v.matchedPrefixWords}`)
}

console.log('\nrouter reply parsing')
{
  const good = parseRouterReply(
    'TYPE: recommendation\nOPTIONS: 3\nDESTRUCTIVE: no\nSPAN: I recommend option one.\nSPAN: Pin the status in the WHERE clause.',
  )
  const a = good.payload.spans.length === 2 && good.payload.optionCount === 3 && good.problems.length === 0
  const stray = parseRouterReply('Sure! Here you go:\nTYPE: result\nOPTIONS: none\nDESTRUCTIVE: no\nSPAN: It passed.')
  const b = stray.problems.some((p) => p.includes('stray')) && stray.payload.spans.length === 1
  const empty = parseRouterReply('I cannot do that.')
  const c = empty.problems.some((p) => p.includes('no SPAN'))
  for (const [ok, label] of [
    [a, 'well-formed reply'],
    [b, 'stray prose flagged, spans still recovered'],
    [c, 'no-SPAN reply flagged rather than silently empty'],
  ] as const) {
    if (!ok) failures++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  }
}

console.log('\nverdict parsing')
{
  const cases: [string, boolean, boolean][] = [
    ['VERDICT: yes\nEVIDENCE: "it fixes the race"', true, false],
    ['VERDICT: no\nEVIDENCE: polarity preserved', false, false],
    ['I think it is probably fine', false, true],
  ]
  for (const [reply, wantViolation, wantUnparsable] of cases) {
    const v = parseVerdict(reply)
    const ok = v.violation === wantViolation && v.unparsable === wantUnparsable
    if (!ok) failures++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${JSON.stringify(reply.slice(0, 32))}`)
  }
}

console.log(`\n${failures === 0 ? 'instrument OK' : `${failures} FAILURE(S) — do not trust any run`}`)
process.exit(failures === 0 ? 0 : 1)
