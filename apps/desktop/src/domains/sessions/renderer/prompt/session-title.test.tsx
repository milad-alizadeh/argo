import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SessionTitle } from './session-title'

describe('formatting a Session title', () => {
  test('renders prompt links as plain title text', () => {
    const markup = renderToStaticMarkup(
      createElement(SessionTitle, {
        session: { harness: 'claude' },
        text: 'Read [the guide](https://example.com/guide) first.',
      }),
    )

    expect(markup).toContain('Read the guide first.')
    expect(markup).not.toContain('<a ')
  })
})
