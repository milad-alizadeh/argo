// The packaged Session fakes share this plan, so a printed seed replays their timing and failures.
export const ADVERSARIAL_TURN_COUNT = 5

export type AdversarialTurn = {
  firstReplyDelayMs: number
  replySplitByte: number
  outcome: 'reply' | 'failure' | 'stall'
  permissionBeforeReply: boolean
}

function seededRandom(seed: string) {
  let state = 2_166_136_261
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0
    state = Math.imul(state, 16_777_619)
  }
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function shuffledOutcomes(random: () => number) {
  const outcomes: AdversarialTurn['outcome'][] = ['reply', 'reply', 'reply', 'failure', 'stall']
  for (let index = outcomes.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const current = outcomes[index]
    const selected = outcomes[other]
    if (current === undefined || selected === undefined) throw new Error('invalid outcome index')
    outcomes[index] = selected
    outcomes[other] = current
  }
  return outcomes
}

export function adversarialTurnsForSeed(seed: string): readonly AdversarialTurn[] {
  const random = seededRandom(seed)
  const outcomes = shuffledOutcomes(random)
  const permissionTurn = Math.floor(random() * outcomes.length)
  return outcomes.map((outcome, index) => ({
    firstReplyDelayMs: 25 + Math.floor(random() * 101),
    replySplitByte: 1 + Math.floor(random() * 8),
    outcome,
    permissionBeforeReply: index === permissionTurn,
  }))
}

export function adversarialTurn(seed: string, turnIndex: number): AdversarialTurn {
  const planned = adversarialTurnsForSeed(seed)[turnIndex % ADVERSARIAL_TURN_COUNT]
  if (planned === undefined) throw new Error('missing adversarial turn')
  return planned
}
