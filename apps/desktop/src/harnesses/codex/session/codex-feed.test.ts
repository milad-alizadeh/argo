import { expect, test } from 'bun:test'
import type { ThreadItem } from '../app-server'
import { codexFeedContent } from './codex-feed'

test('carries a recorded request_user_input call as its questions', () => {
  const item: ThreadItem = {
    type: 'dynamicToolCall',
    id: 'ask-1',
    namespace: null,
    tool: 'request_user_input',
    arguments: {
      questions: [
        {
          id: 'color',
          header: 'Color',
          question: 'Which color?',
          options: [{ label: 'Red', description: 'Warm' }, { label: 'Blue' }],
        },
      ],
    },
    status: 'inProgress',
    contentItems: null,
    success: null,
    durationMs: null,
  }
  const [content] = codexFeedContent(item, () => {})
  expect(content?.kind === 'tool' && content.presentation?.questions).toEqual([
    {
      question: 'Which color?',
      header: 'Color',
      multiSelect: false,
      options: [
        { label: 'Red', description: 'Warm' },
        { label: 'Blue', description: null },
      ],
    },
  ])
})
