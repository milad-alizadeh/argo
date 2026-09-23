function tagContents(text: string, name: string) {
  return text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null
}

const commandTags = /<\/?command-(?:args|message|name)>/g
// Text pasted into the prompt is wrapped as `<pasted_content id="c485">…</pasted_content id="c485">`.
const pastedTags = /<\/?pasted_content id="[^"]*">/g
const pastedBlock = /<pasted_content id="([^"]*)">([\s\S]*?)<\/pasted_content id="\1">/g

// Claude keeps a sent slash command in tags that are not part of the person's prompt.
export function commandSource(text: string) {
  const name = tagContents(text, 'command-name')
  if (name === null)
    return (
      tagContents(text, 'command-message') ??
      text.replace(commandTags, '').replace(pastedTags, '').trim()
    )
  const argumentsText = tagContents(text, 'command-args')
  return argumentsText === null || argumentsText.length === 0 ? name : `${name} ${argumentsText}`
}

type CommandSourceBlock =
  | { shape: 'prose'; text: string }
  | { shape: 'pasted-content'; id: string; text: string }

function proseBlock(text: string): CommandSourceBlock[] {
  const prose = text.replace(commandTags, '').trim()
  return prose === '' ? [] : [{ shape: 'prose', text: prose }]
}

function pastedContentBlocks(text: string, matches: RegExpMatchArray[]): CommandSourceBlock[] {
  const blocks: CommandSourceBlock[] = []
  let offset = 0
  for (const match of matches) {
    const start = match.index ?? 0
    blocks.push(...proseBlock(text.slice(offset, start)))
    const pasted = match[2]?.trim() ?? ''
    if (pasted !== '') blocks.push({ shape: 'pasted-content', id: match[1] ?? '', text: pasted })
    offset = start + match[0].length
  }
  blocks.push(...proseBlock(text.slice(offset)))
  return blocks
}

export function commandSourceBlocks(text: string): CommandSourceBlock[] {
  if (tagContents(text, 'command-name') !== null || tagContents(text, 'command-message') !== null)
    return [{ shape: 'prose', text: commandSource(text) }]
  const matches = [...text.matchAll(pastedBlock)]
  return matches.length === 0
    ? [{ shape: 'prose', text: commandSource(text) }]
    : pastedContentBlocks(text, matches)
}
