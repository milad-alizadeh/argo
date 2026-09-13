const PASTE_START = '\u001b[200~'
const PASTE_END = '\u001b[201~'

function pasted(text: string): string {
  let value = text
  while (value.includes(PASTE_START) || value.includes(PASTE_END)) {
    value = value.replaceAll(PASTE_START, '').replaceAll(PASTE_END, '')
  }
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

export function claudeTurn(text: string): { paste: string; submit: string } {
  return { paste: `${PASTE_START}${pasted(text)}${PASTE_END}`, submit: '\r' }
}
