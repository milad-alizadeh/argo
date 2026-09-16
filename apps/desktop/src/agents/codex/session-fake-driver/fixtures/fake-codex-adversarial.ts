import { adversarialTurn } from '../../../../core/sessions/fake-driver/adversarial-turns.ts'

export function nextAdversarialTurn(seed: string | undefined, turnIndex: number) {
  return seed === undefined ? null : adversarialTurn(seed, turnIndex)
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
