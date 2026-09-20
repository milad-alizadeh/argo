import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import type { Wait } from '@/harnesses/claude/drive/deliver-turn'

export type AnswerTarget = { process: { write: (text: string) => void } }

const DOWN = '[B'
const ENTER = '\r'
const SPACE = ' '
// Measured against Claude Code 2.1.270: the picker's first Down needs the render to have already
// settled, and each following key needs the highlight to have moved before the next is sent.
const KEY_PRESS_DELAY_MS = 80
const SUBMIT_DELAY_MS = 150

// Presses Down enough times to move the highlight `rows` rows further from wherever it already is.
async function pressDown(target: AnswerTarget, rows: number, wait: Wait) {
  for (let step = 0; step < rows; step += 1) {
    target.process.write(DOWN)
    await wait(KEY_PRESS_DELAY_MS)
  }
}

// One question's answer, in the picker's own row order: the offered options, then one further
// row for "Type something." (`index` counts from there, 1-based, per claude-contract.ts).
async function deliverOne(target: AnswerTarget, answer: QuestionAnswer, wait: Wait) {
  if (answer.kind === 'text') {
    // The picker opens with row 1 already highlighted (confirmed), so reaching row N is N-1 presses.
    await pressDown(target, answer.index - 1, wait)
    target.process.write(ENTER)
    await wait(SUBMIT_DELAY_MS)
    target.process.write(answer.text)
    await wait(SUBMIT_DELAY_MS)
    target.process.write(ENTER)
    return
  }
  // Single-select: Down to the row, Enter (confirmed against the real Harness). Multi-select: Space
  // toggles a row without leaving the list, so every target index is visited in ascending order
  // off the same cursor, then one Enter submits the set. The Space-toggle and the shared cursor
  // are UNVERIFIED — no probe has driven a multiSelect question yet — so this path can misfire
  // against a future Harness build until it is measured for real.
  let cursor = 1
  for (const index of answer.indices) {
    await pressDown(target, index - cursor, wait)
    cursor = index
    if (answer.indices.length > 1) {
      target.process.write(SPACE)
      await wait(KEY_PRESS_DELAY_MS)
    }
  }
  target.process.write(ENTER)
}

export async function deliverAnswer(target: AnswerTarget, answers: QuestionAnswer[], wait: Wait) {
  for (const answer of answers) {
    await deliverOne(target, answer, wait)
    await wait(SUBMIT_DELAY_MS)
  }
}
