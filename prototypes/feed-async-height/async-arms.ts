/**
 * The other three async cases #1793 names, plus the failure case.
 *
 * The ticket asks for "the same numbers" for a remote image, a late web font and a code block
 * awaiting a highlighter. They are not the same KIND of case, and the measurement has to say
 * so rather than produce three comparable milliseconds:
 *
 * - An image's height is not slow, it is UNKNOWN. The cost is a network round trip and has no
 *   upper bound, so the number to report is not the median but the fact that reserving the box
 *   removes the wait entirely. Both are measured here.
 * - A web font's height is knowable but WRONG until the face arrives: the block reflows from
 *   fallback metrics to real ones. The number that matters is the height DELTA, not the time.
 * - A highlighter is the reassuring one, and the measurement is what proves it: syntax
 *   highlighting recolours a fixed number of monospace lines. If the height before and after
 *   are equal, a code block is not an async height case at all and the pass need not wait.
 *
 * Everything is served from the local `serve.ts`, which can delay a response on demand. That
 * keeps the numbers about the browser rather than about somebody's CDN — a remote image's real
 * cost is whatever the network is doing, which is a fact about the network and is stated as
 * one in the report rather than measured here.
 */

import type { BundledLanguage, BundledTheme, HighlighterGeneric } from 'shiki'
import { CODE_STYLE, COLUMN_WIDTH, forceLayout, withMeasureBox } from './measure'

export type Sample = { readonly label: string; readonly ms: number; readonly note?: string }

const now = (): number => performance.now()

/**
 * An image with no reserved box against the same image with one. The delay is served, not
 * simulated in JS, so the wait is a real resource load on the real network stack.
 */
export async function imageArm(host: HTMLElement, delayMs: number): Promise<Sample[]> {
  const out: Sample[] = []
  for (const reserved of [false, true]) {
    const sample = await withMeasureBox(host, async (box) => {
      const img = document.createElement('img')
      img.src = `/image.png?delay=${delayMs}&bust=${Math.random()}`
      if (reserved) {
        img.width = 240
        img.height = 120
        img.style.aspectRatio = '2 / 1'
        img.style.width = '240px'
        img.style.height = '120px'
      }
      const started = now()
      box.append(img)
      const atInsert = forceLayout(box)
      await new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
      const settled = forceLayout(box)
      return {
        label: reserved ? 'image, box reserved' : 'image, no reserved box',
        ms: now() - started,
        note: `height at insert ${atInsert}px, settled ${settled}px`,
      }
    })
    out.push(sample)
  }
  return out
}

/**
 * A prose block measured under the fallback face, then again once a late-arriving face has
 * loaded. The face is a real file served locally, so the delta is a genuine metric change
 * rather than a synthetic one.
 *
 * `line-height: normal` is load-bearing: it is the only setting under which the arriving face's
 * own metrics decide the height, rather than a multiple of the font SIZE. And the sample reports
 * whether the face actually applied, because a face that failed to load measures exactly like
 * one that changed nothing.
 */
export async function fontArm(host: HTMLElement, delayMs: number): Promise<Sample[]> {
  const family = `Late${Math.floor(Math.random() * 1e9)}`
  const style = document.createElement('style')
  style.textContent = `@font-face { font-family: '${family}'; src: url('/font.ttf?delay=${delayMs}&bust=${Math.random()}'); font-display: swap; }`
  document.head.append(style)

  const sample = await withMeasureBox(host, async (box) => {
    box.style.cssText = `width: ${COLUMN_WIDTH}px; font-family: '${family}', -apple-system, sans-serif; font-size: 14px; line-height: normal`
    box.textContent = LOREM

    const started = now()
    const fallbackHeight = forceLayout(box)
    await document.fonts.load(`14px '${family}'`)
    await document.fonts.ready
    const loadedMs = now() - started
    const applied = document.fonts.check(`14px '${family}'`)
    const settledHeight = forceLayout(box)

    return {
      label: 'late web font',
      ms: loadedMs,
      note: !applied
        ? 'FACE NEVER APPLIED - this sample says nothing'
        : `fallback ${fallbackHeight}px → real face ${settledHeight}px, delta ${(settledHeight - fallbackHeight).toFixed(1)}px`,
    }
  })
  style.remove()

  return [sample]
}

const LOREM =
  'The pass exists so that no row is drawn before its height is final, which means every ' +
  'source of a late height has to be either awaited or removed. A face that arrives after ' +
  'the first paint reflows the prose it was measured under, and the document that was settled ' +
  'stops being settled without anything having been appended to it at all.'

/**
 * The same code, drawn plain and then highlighted. `ms` is the highlight cost; the note
 * carries the answer the contract actually needs, which is whether the height moved.
 */
export async function highlightArm(
  host: HTMLElement,
  highlighter: HighlighterGeneric<BundledLanguage, BundledTheme>,
  blocks: ReadonlyArray<{ id: string; lang: string; source: string }>,
): Promise<Sample[]> {
  const out: Sample[] = []
  for (const block of blocks) {
    const sample = await withMeasureBox(host, (box) => {
      const plain = document.createElement('pre')
      plain.style.cssText = CODE_STYLE
      plain.textContent = block.source
      box.append(plain)
      const plainHeight = forceLayout(box)

      const started = now()
      const html = highlighter.codeToHtml(block.source, {
        lang: block.lang as BundledLanguage,
        theme: 'github-dark',
      })
      const highlightMs = now() - started
      box.innerHTML = html
      const pre = box.querySelector('pre')
      if (pre) pre.style.cssText = CODE_STYLE
      const litHeight = forceLayout(box)

      return {
        label: `highlight ${block.lang} ${block.id}`,
        ms: highlightMs,
        note: `plain ${plainHeight}px → highlighted ${litHeight}px, delta ${(litHeight - plainHeight).toFixed(1)}px`,
      }
    })
    out.push(sample)
  }
  return out
}

export type Failure = {
  readonly threw: boolean
  readonly message: string
  /** Nodes mermaid left behind in the document after the failure, by tag and id. */
  readonly strayNodes: string[]
  /** The height a caller would have to give the row, if any element survived to be measured. */
  readonly heightIfDrawn: number | null
}

/**
 * What a diagram that cannot render does. #1793 asks for this explicitly, and it is the case a
 * contract about final heights is most likely to have no answer for.
 */
export async function failureArm(
  host: HTMLElement,
  render: (id: string, source: string) => Promise<{ svg: string }>,
): Promise<Failure> {
  const before = new Set(Array.from(document.body.children))
  let threw = false
  let message = ''
  let svg = ''
  try {
    const result = await render('feed-async-height-failure', 'flowchart TB\n  A --> ((( bad')
    svg = result.svg
  } catch (error) {
    threw = true
    message = error instanceof Error ? error.message : String(error)
  }
  const strayNodes = Array.from(document.body.children)
    .filter((el) => !before.has(el))
    .map((el) => `${el.tagName.toLowerCase()}#${el.id || '(no id)'}`)

  let heightIfDrawn: number | null = null
  if (svg) {
    heightIfDrawn = await withMeasureBox(host, (box) => {
      box.innerHTML = svg
      return forceLayout(box)
    })
  }
  for (const el of Array.from(document.body.children)) {
    if (!before.has(el) && el !== host) el.remove()
  }
  return { threw, message, strayNodes, heightIfDrawn }
}
