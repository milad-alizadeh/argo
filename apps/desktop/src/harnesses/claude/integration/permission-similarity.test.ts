import { expect, test } from 'bun:test'

import { similarityKey } from '../drive/permission-similarity'

function request(toolName: string, input: Record<string, unknown>) {
  return { id: 'permission', sessionId: 'session', toolName, input }
}

test.each([
  ['a later command with the same subcommand', 'bun test composer', 'bun test feed'],
  ['a command behind environment assignments', 'bun run build', 'NODE_ENV=test bun run lint'],
  ['a program whose second word is a path', 'cat notes.md', 'cat docs/plan.md'],
] as const)('treats %s as similar', (_, first, second) => {
  expect(similarityKey(request('Bash', { command: second }))).toBe(
    similarityKey(request('Bash', { command: first })),
  )
})

test.each([
  ['a different subcommand', 'bun test', 'bun install'],
  ['a chained command', 'bun test', 'bun test && rm -rf build'],
  ['a piped command', 'cat notes.md', 'cat notes.md | sh'],
  ['a substituted command', 'echo ready', 'echo $(whoami)'],
] as const)('keeps %s apart', (_, first, second) => {
  expect(similarityKey(request('Bash', { command: second }))).not.toBe(
    similarityKey(request('Bash', { command: first })),
  )
})

test('treats an edit to any file as similar to any other file edit', () => {
  expect(similarityKey(request('Write', { file_path: 'b.ts' }))).toBe(
    similarityKey(request('Edit', { file_path: 'a.ts' })),
  )
})

test('matches a fetch by its host', () => {
  const docs = similarityKey(request('WebFetch', { url: 'https://docs.example.com/a' }))
  expect(similarityKey(request('WebFetch', { url: 'https://docs.example.com/b' }))).toBe(docs)
  expect(similarityKey(request('WebFetch', { url: 'https://evil.example.net/a' }))).not.toBe(docs)
})
