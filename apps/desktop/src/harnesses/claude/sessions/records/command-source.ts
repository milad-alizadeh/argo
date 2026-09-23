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

export function commandSourceBlocks(text: string) {
  if (tagContents(text, 'command-name') !== null || tagContents(text, 'command-message') !== null)
    return [{ shape: 'prose' as const, text: commandSource(text) }]
  const blocks: (
    | { shape: 'prose'; text: string }
    | { shape: 'pasted-content'; id: string; text: string }
  )[] = []
  let offset = 0
  for (const match of text.matchAll(pastedBlock)) {
    const start = match.index ?? 0
    const before = text.slice(offset, start).replace(commandTags, '').trim()
    if (before !== '') blocks.push({ shape: 'prose', text: before })
    const pasted = match[2]?.trim() ?? ''
    if (pasted !== '') blocks.push({ shape: 'pasted-content', id: match[1] ?? '', text: pasted })
    offset = start + match[0].length
  }
  if (offset === 0) return [{ shape: 'prose' as const, text: commandSource(text) }]
  const after = text.slice(offset).replace(commandTags, '').trim()
  if (after !== '') blocks.push({ shape: 'prose', text: after })
  return blocks
}
