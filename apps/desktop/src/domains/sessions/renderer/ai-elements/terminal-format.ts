import Anser from 'anser'
import { escapeCarriageReturn } from 'escape-carriage'

type RgbColor = { kind: 'rgb'; channels: readonly [number, number, number] }
const protocolColorNames = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'bright-black',
  'bright-red',
  'bright-green',
  'bright-yellow',
  'bright-blue',
  'bright-magenta',
  'bright-cyan',
  'bright-white',
] as const
type ProtocolColor = { kind: 'protocol'; name: (typeof protocolColorNames)[number] }
export type TerminalColor = RgbColor | ProtocolColor
export type TerminalRun = {
  text: string
  foreground: TerminalColor | null
  background: TerminalColor | null
  decoration: Anser.DecorationName | null
}

function trueColor(value: string | null): RgbColor | null {
  if (value === null) return null
  const channels = value.split(',').map(Number)
  const [red, green, blue] = channels
  if (
    channels.length !== 3 ||
    red === undefined ||
    green === undefined ||
    blue === undefined ||
    channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)
  ) {
    return null
  }
  return { kind: 'rgb', channels: [red, green, blue] }
}

function color(
  {
    value,
    source,
    resolved,
  }: { value: string | null; source: string | null; resolved: string | null },
  reject: () => void,
): TerminalColor | null {
  if (value === null) return null
  const name = protocolColorNames.find((candidate) => value === `ansi-${candidate}`)
  if (name !== undefined) return { kind: 'protocol', name }
  if (value === 'ansi-truecolor') {
    const rgb = trueColor(source)
    if (rgb === null) reject()
    return rgb
  }
  const indexed = /^ansi-palette-(\d{1,3})$/.exec(value)
  if (indexed !== null && Number(indexed[1]) >= 16 && Number(indexed[1]) <= 255) {
    const rgb = trueColor(resolved)
    if (rgb === null) reject()
    return rgb
  }
  reject()
  return null
}

function preprocess(output: string): string {
  const retained: string[] = []
  for (let index = 0; index < output.length; index++) {
    const character = output.charAt(index)
    const previous = retained.at(-1)
    if (character === '\b' && previous !== undefined && previous !== '\n') retained.pop()
    else retained.push(character)
  }
  return escapeCarriageReturn(retained.join(''))
}

export function formatTerminalOutput(output: string): TerminalRun[] {
  const prepared = preprocess(output)
  let rejected = 0
  const reject = () => rejected++
  const resolved = Anser.ansiToJson(prepared, { remove_empty: true })
  const runs = Anser.ansiToJson(prepared, { use_classes: true, remove_empty: true }).map(
    (entry, index) => {
      const rgb = resolved[index]
      if (rgb === undefined || rgb.content !== entry.content) {
        reject()
        return {
          text: entry.content,
          foreground: null,
          background: null,
          decoration: entry.decoration,
        }
      }
      return {
        text: entry.content,
        foreground: color(
          { value: entry.fg, source: entry.fg_truecolor, resolved: rgb.fg },
          reject,
        ),
        background: color(
          { value: entry.bg, source: entry.bg_truecolor, resolved: rgb.bg },
          reject,
        ),
        decoration: entry.decoration,
      }
    },
  )
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported ANSI output shape(s).`)
  return runs
}
