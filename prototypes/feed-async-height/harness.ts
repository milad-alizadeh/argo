/**
 * The rig #1793 asks for: render every mermaid diagram a real transcript holds, in a browser,
 * and time them.
 *
 * Two things about the method, because they decide whether the numbers mean anything.
 *
 * THE MACHINE IS A VARIABLE. Repeats are interleaved round-robin across diagrams rather than
 * run N times each in a row, so a thermal or scheduling excursion lands on every diagram
 * instead of on whichever one was unlucky. Each diagram reports its LEAST time as well as its
 * median: the least is the closest thing to the code's own cost, the median carries what the
 * machine did to it.
 *
 * COLD AND WARM ARE DIFFERENT NUMBERS. mermaid 11 loads a diagram type's module on first use,
 * so the first flowchart in a document pays an import the second does not. A whole-document
 * pass pays every kind's cold cost exactly once, and then a warm cost per diagram. Reporting
 * one blended average would hide both. So the first render of each kind is recorded separately
 * and excluded from that kind's warm statistics.
 *
 * The measure happens where ADR-0030-for-the-DOM says it happens: inside a
 * `content-visibility: hidden` container. The container's own box is size-contained and reads
 * zero — that trap is recorded rather than worked around, because a pass that measures the
 * wrong element is the bug this rig exists to price.
 */

import mermaid from 'mermaid'
import { createHighlighter } from 'shiki'
import { failureArm, fontArm, highlightArm, imageArm, type Sample } from './async-arms'
import { kindOf, type Score, score } from './predict'
import { synthetics } from './synthetic'

type Block = { id: string; lang: string; source: string; bytes: number; lines: number }

/**
 * Five of the twelve mined diagrams carry `&gt;` where they mean `>`, so mermaid refuses them.
 * That is not the rig mangling them — the transcripts hold them escaped — and it is a finding
 * in its own right, reported as `htmlEscaped`. It is also a problem for the MEASUREMENT: five
 * renderable diagrams is not a sample. So a refused source is retried unescaped, and every
 * result says which source it timed.
 */
const ENTITIES: ReadonlyArray<[RegExp, string]> = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, '&'],
]

const unescapeHtml = (source: string): string =>
  ENTITIES.reduce((text, [pattern, char]) => text.replace(pattern, char), source)

/** `true` when mermaid can parse the source at all. `mermaid.parse` throws when it cannot. */
async function parses(source: string): Promise<boolean> {
  try {
    await mermaid.parse(source)
    return true
  } catch {
    return false
  }
}

/**
 * The source the sweep should time, and how it was arrived at. A diagram that parses neither as
 * found nor unescaped is returned as-is, and fails in the sweep where it is recorded.
 */
async function usableSource(
  block: Block,
): Promise<{ source: string; htmlEscaped: boolean; unreadable: boolean }> {
  if (await parses(block.source)) {
    return { source: block.source, htmlEscaped: false, unreadable: false }
  }
  const repaired = unescapeHtml(block.source)
  if (repaired !== block.source && (await parses(repaired))) {
    return { source: repaired, htmlEscaped: true, unreadable: false }
  }
  return { source: block.source, htmlEscaped: false, unreadable: true }
}

const REPEATS = 7
const COLUMN_WIDTH = 600

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const log = (line: string): void => {
  const el = document.getElementById('log')
  if (el) el.textContent = `${el.textContent ?? ''}${line}\n`
  console.log(`[1793] ${line}`)
}

/** The measurement container the DOM restatement of ADR-0030 rule 3 mandates. */
function measureHost(): HTMLElement {
  const host = document.createElement('div')
  host.id = 'measure-host'
  host.style.cssText = `content-visibility: hidden; width: ${COLUMN_WIDTH}px; font: 14px/1.5 -apple-system, sans-serif`
  document.body.append(host)
  return host
}

export type DiagramResult = {
  readonly id: string
  readonly kind: string
  readonly bytes: number
  readonly lines: number
  readonly nodes: number | null
  readonly coldRenderMs: number | null
  readonly renderMsLeast: number
  readonly renderMsMedian: number
  readonly measureMsLeast: number
  readonly height: number
  readonly width: number
  /** What the size-contained container reported, next to what the inner element did. */
  readonly containerHeight: number
  /** Set where mermaid refused the source. Every timing on such a row is meaningless. */
  readonly parseError: string | null
  /** The mined source was HTML-escaped and had to be repaired before it would parse. */
  readonly htmlEscaped: boolean
}

type Timing = { render: number; measure: number }
type Rendered = {
  timing: Timing
  height: number
  width: number
  containerHeight: number
  error: string | null
}

/**
 * One render-and-measure of one diagram, exactly as a whole-document pass would do it.
 *
 * The failure is caught HERE rather than around the sweep, because one unreadable diagram must
 * not take the other eleven with it — which is also the shape a real pass needs, and the first
 * version of this rig got wrong.
 */
async function renderOnce(host: HTMLElement, id: string, source: string): Promise<Rendered> {
  const t0 = performance.now()
  let svg = ''
  try {
    const result = await mermaid.render(`d-${id}-${Math.floor(Math.random() * 1e9)}`, source)
    svg = result.svg
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      timing: { render: performance.now() - t0, measure: 0 },
      height: 0,
      width: 0,
      containerHeight: 0,
      error: message.split('\n')[0],
    }
  }
  const t1 = performance.now()

  const box = document.createElement('div')
  box.style.width = `${COLUMN_WIDTH}px`
  box.innerHTML = svg
  host.append(box)
  const rect = box.getBoundingClientRect()
  const containerHeight = host.getBoundingClientRect().height
  const t2 = performance.now()
  box.remove()

  return {
    timing: { render: t1 - t0, measure: t2 - t1 },
    height: rect.height,
    width: rect.width,
    containerHeight,
    error: null,
  }
}

async function mermaidArm(
  host: HTMLElement,
  blocks: ReadonlyArray<Block & { nodes?: number; htmlEscaped?: boolean }>,
): Promise<DiagramResult[]> {
  const timings = new Map<string, Timing[]>()
  const geometry = new Map<string, { height: number; width: number; containerHeight: number }>()
  const cold = new Map<string, number>()
  const coldKinds = new Set<string>()
  const errors = new Map<string, string>()

  for (const block of blocks) {
    const kind = kindOf(block.source)
    if (coldKinds.has(kind)) continue
    coldKinds.add(kind)
    const first = await renderOnce(host, block.id, block.source)
    if (first.error) {
      coldKinds.delete(kind)
      continue
    }
    cold.set(block.id, first.timing.render)
    log(`cold ${kind} via ${block.id}: ${first.timing.render.toFixed(1)}ms`)
  }

  for (let pass = 0; pass < REPEATS; pass++) {
    for (const block of blocks) {
      const { timing, height, width, containerHeight, error } = await renderOnce(
        host,
        block.id,
        block.source,
      )
      if (error) {
        errors.set(block.id, error)
        continue
      }
      timings.set(block.id, [...(timings.get(block.id) ?? []), timing])
      geometry.set(block.id, { height, width, containerHeight })
    }
    log(`pass ${pass + 1}/${REPEATS} done`)
  }

  return blocks.map((block) => {
    const runs = timings.get(block.id) ?? [{ render: Number.NaN, measure: Number.NaN }]
    const geo = geometry.get(block.id) ?? { height: 0, width: 0, containerHeight: 0 }
    return {
      parseError: errors.get(block.id) ?? null,
      htmlEscaped: Boolean((block as { htmlEscaped?: boolean }).htmlEscaped),
      id: block.id,
      kind: kindOf(block.source),
      bytes: block.bytes,
      lines: block.lines,
      nodes: block.nodes ?? null,
      coldRenderMs: cold.get(block.id) ?? null,
      renderMsLeast: Math.min(...runs.map((r) => r.render)),
      renderMsMedian: median(runs.map((r) => r.render)),
      measureMsLeast: Math.min(...runs.map((r) => r.measure)),
      height: geo.height,
      width: geo.width,
      containerHeight: geo.containerHeight,
    }
  })
}

/** A spread of the languages the corpus actually holds, capped so the arm stays a minute. */
function highlightSample(blocks: Block[]): Block[] {
  const wanted = ['ts', 'swift', 'json', 'bash', 'tsx']
  return wanted
    .map((lang) => blocks.filter((b) => b.lang === lang).sort((a, b) => b.bytes - a.bytes)[0])
    .filter((b): b is Block => Boolean(b))
}

/**
 * `?arms=async` re-runs only the image, font, highlighter and failure arms. The mermaid sweep
 * takes about eight minutes and blocks the tab for all of it, so iterating on one of the cheap
 * arms without a switch means either waiting it out or deleting code to skip it.
 */
const ASYNC_ONLY = new URLSearchParams(location.search).get('arms') === 'async'

async function run(): Promise<void> {
  const corpus: { blocks: Block[] } = await (await fetch('/corpus.json')).json()
  const mined = corpus.blocks.filter((b) => b.lang === 'mermaid')
  log(`corpus: ${corpus.blocks.length} blocks, ${mined.length} mermaid`)

  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', suppressErrorRendering: false })
  const host = measureHost()

  const diagrams: Array<Block & { htmlEscaped: boolean }> = []
  let unreadable = 0
  for (const block of mined) {
    const { source, htmlEscaped, unreadable: dead } = await usableSource(block)
    if (dead) unreadable += 1
    diagrams.push({ ...block, source, htmlEscaped })
  }
  const escaped = diagrams.filter((d) => d.htmlEscaped).length
  log(`as found: ${escaped} HTML-escaped and repaired, ${unreadable} unreadable by any route`)

  const real = ASYNC_ONLY ? [] : await mermaidArm(host, diagrams)
  log('real diagrams done')
  const synthetic = ASYNC_ONLY
    ? []
    : await mermaidArm(
        host,
        synthetics().map((s) => ({
          id: s.id,
          lang: 'mermaid',
          source: s.source,
          bytes: new TextEncoder().encode(s.source).length,
          lines: s.source.split('\n').length,
          nodes: s.nodes,
        })),
      )
  log('synthetic diagrams done')

  // A diagram mermaid refused has no drawn height, so scoring the predictor against it would
  // be scoring it against zero. Those rows are reported as failures, not as prediction misses.
  const scores: Score[] = diagrams
    .map((block) => ({ block, measured: real.find((r) => r.id === block.id) }))
    .filter(({ measured }) => measured && !measured.parseError && measured.height > 0)
    .map(({ block, measured }) => score(block.id, block.source, measured?.height ?? 0))

  const highlighter = await createHighlighter({
    themes: ['github-dark'],
    langs: ['ts', 'tsx', 'swift', 'json', 'bash'],
  })
  const samples: Sample[] = [
    ...(await imageArm(host, 120)),
    ...(await fontArm(host, 120)),
    ...(await highlightArm(host, highlighter, highlightSample(corpus.blocks))),
  ]
  log('async arms done')

  const failure = await failureArm(host, (id, source) => mermaid.render(id, source))
  log(`failure: threw=${failure.threw} stray=${failure.strayNodes.join(',') || 'none'}`)

  const results = {
    ranAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    columnWidth: COLUMN_WIDTH,
    repeats: REPEATS,
    mermaidVersion: (mermaid as unknown as { version?: string }).version ?? 'unknown',
    mined: mined.length,
    htmlEscaped: escaped,
    unreadable,
    real,
    synthetic,
    scores,
    samples,
    failure,
  }
  ;(window as unknown as { __RESULTS__: unknown }).__RESULTS__ = results
  // An `?arms=async` run holds no mermaid numbers, so it must never overwrite the full run.
  await fetch(ASYNC_ONLY ? '/results?arms=async' : '/results', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(results, null, 2),
  })
  log('DONE — results posted')
}

run().catch((error) => {
  log(`FAILED: ${error instanceof Error ? error.stack : String(error)}`)
})
