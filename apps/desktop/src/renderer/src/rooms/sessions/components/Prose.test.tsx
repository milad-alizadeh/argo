import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Prose } from './Prose'

// Rendered to static markup rather than mounted, because every claim here is about WHICH markup a
// transcript string is allowed to become — and the string the browser would receive is exactly the
// thing under test. A story proves it looks right; this proves nothing else got through.
const render = (markdown: string): string =>
  renderToStaticMarkup(<Prose markdown={markdown} variant="prose" />)

describe('the constructs the feed reads', () => {
  it.each([
    { behaviour: 'emphasises bold', markdown: 'a **bold** word', element: '<strong' },
    { behaviour: 'emphasises italic', markdown: 'a *slanted* word', element: '<em' },
    { behaviour: 'sets an identifier as code', markdown: 'it closes `#list`', element: '<code' },
    { behaviour: 'sets a fence as a block', markdown: '```ts\nconst x = 1\n```', element: '<pre' },
    { behaviour: 'reads a dash run as a list', markdown: '- one\n- two', element: '<ul' },
    { behaviour: 'reads a number run as a list', markdown: '1. one\n2. two', element: '<ol' },
  ])('$behaviour', ({ markdown, element }) => {
    expect(render(markdown)).toContain(element)
  })

  it('names the language a fence declared', () => {
    expect(render('```css\n#list {}\n```')).toContain('css')
  })

  it('keeps the blank line between two paragraphs', () => {
    expect(render('first\n\nsecond').match(/<p/g)).toHaveLength(2)
  })
})

describe('the constructs the feed refuses', () => {
  it.each([
    { syntax: 'a heading', markdown: '## Rotation', literal: '## Rotation', element: '<h' },
    {
      syntax: 'a table',
      markdown: '| a | b |\n| - | - |\n| 1 | 2 |',
      literal: '| a | b |',
      element: '<table',
    },
    {
      syntax: 'a remote image',
      markdown: '![alt](https://elsewhere.test/x.png)',
      literal: '![alt](https',
      element: '<img',
    },
    {
      syntax: 'a blockquote',
      markdown: '> quoted',
      literal: '&gt; quoted',
      element: '<blockquote',
    },
    { syntax: 'a horizontal rule', markdown: '---', literal: '---', element: '<hr' },
  ])('degrades $syntax to its literal text', ({ markdown, literal, element }) => {
    const html = render(markdown)
    expect(html).toContain(literal)
    expect(html).not.toContain(element)
  })

  it('renders a written-out tag as characters rather than as an element', () => {
    const html = render('the agent wrote <b>bold</b> and <script>alert(1)</script>')
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<script>')
  })

  it('escapes markup that arrives inside a fenced block', () => {
    const html = render('```html\n<img src=x onerror=alert(1)>\n```')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img')
  })
})

describe('where a link in agent prose can take you', () => {
  it('sends a browsable destination to the browser rather than navigating the window', () => {
    const html = render('see [the ticket](https://example.test/315)')
    expect(html).toContain('href="https://example.test/315"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer noopener"')
  })

  it.each([
    { kind: 'a script URL', markdown: '[click](javascript:alert(1))' },
    { kind: 'a data URL', markdown: '[click](data:text/html,alert)' },
    { kind: 'a file URL', markdown: '[click](file:///etc/passwd)' },
    { kind: 'a relative path', markdown: '[click](./local.md)' },
  ])('keeps the words of $kind and drops its destination', ({ markdown }) => {
    const html = render(markdown)
    expect(html).toContain('click')
    expect(html).not.toContain('href')
  })
})

describe('markup the agent left half-finished', () => {
  it.each([
    { malformed: 'an unclosed fence', markdown: '```ts\nconst x = 1' },
    { malformed: 'a stray backtick', markdown: 'a ` lonely backtick' },
    { malformed: 'an unclosed emphasis', markdown: 'a **dangling bold' },
    { malformed: 'an unclosed link', markdown: 'a [dangling link' },
  ])('renders $malformed without losing the rest of the row', ({ markdown }) => {
    expect(render(`${markdown}\n\nthe row continues`)).toContain('the row continues')
  })
})
