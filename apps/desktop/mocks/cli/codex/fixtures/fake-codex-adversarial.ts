type AdversarialTurn = {
  firstReplyDelayMs: number
  replySplitByte: number
  outcome: 'reply' | 'failure' | 'stall'
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

function plannedTurns(seed: string): readonly AdversarialTurn[] {
  const random = seededRandom(seed)
  const outcomes: AdversarialTurn['outcome'][] = ['reply', 'reply', 'reply', 'failure', 'stall']
  for (let index = outcomes.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const current = outcomes[index]
    const selected = outcomes[other]
    if (current === undefined || selected === undefined) throw new Error('invalid outcome index')
    outcomes[index] = selected
    outcomes[other] = current
  }
  return outcomes.map((outcome) => ({
    firstReplyDelayMs: 25 + Math.floor(random() * 101),
    replySplitByte: 1 + Math.floor(random() * 8),
    outcome,
  }))
}

export function nextAdversarialTurn(seed: string | undefined, turnIndex: number) {
  if (seed === undefined) return null
  const planned = plannedTurns(seed)[turnIndex % 5]
  if (planned === undefined) throw new Error('missing adversarial turn')
  return planned
}

// Split a four-byte character so the channel retains decoder state across stdout chunks.
export function writeSplitReply(
  message: Record<string, unknown>,
  splitByte: number,
  write: (chunk: Uint8Array) => void,
) {
  const line = Buffer.from(`${JSON.stringify(message)}\n`)
  const character = Buffer.from('🦜')
  const characterAt = line.indexOf(character)
  const at = characterAt < 0 ? splitByte : characterAt + Math.min(splitByte, character.length - 1)
  write(line.subarray(0, at))
  write(line.subarray(at))
}
