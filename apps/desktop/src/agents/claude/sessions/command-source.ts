function tagContents(text: string, name: string) {
  return text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null
}

const commandTags = /<\/?command-(?:args|message|name)>/g

// Claude keeps a sent slash command in tags that are not part of the person's prompt.
export function commandSource(text: string) {
  const name = tagContents(text, 'command-name')
  if (name === null)
    return tagContents(text, 'command-message') ?? text.replace(commandTags, '').trim()
  const argumentsText = tagContents(text, 'command-args')
  return argumentsText === null || argumentsText.length === 0 ? name : `${name} ${argumentsText}`
}
