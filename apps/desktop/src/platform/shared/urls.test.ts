import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isExternalLink, loadableImageSource } from './urls'

test('an image loads from the web, a data image or a local file', () => {
  for (const [source, loaded] of [
    ['https://example.com/shot.png', 'https://example.com/shot.png'],
    ['http://example.com/shot.png', 'http://example.com/shot.png'],
    ['data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'],
    ['file:///Users/reader/shot.png', 'file:///Users/reader/shot.png'],
    ['/Users/reader/my shot.png', 'file:///Users/reader/my%20shot.png'],
  ] as const)
    assert.equal(loadableImageSource(source), loaded, source)
})

test('an image the Feed cannot resolve is refused', () => {
  for (const source of [
    'shots/relative.png',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://example.com/id',
  ])
    assert.equal(loadableImageSource(source), '', source)
})

test('a web or mail target opens outside the window and every other target does not', () => {
  for (const [target, external] of [
    ['https://github.com/milad-alizadeh/argo', true],
    ['http://example.com', true],
    ['mailto:reader@example.com', true],
    ['javascript:alert(1)', false],
    ['file:///etc/passwd', false],
    ['#heading', false],
    ['docs/readme.md', false],
  ] as const)
    assert.equal(isExternalLink(target), external, target)
})
