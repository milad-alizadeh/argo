import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isRendererDocument, isTrustedRendererFrame } from './is-trusted-renderer-frame'

test('the dev-server renderer is trusted on every route', () => {
  for (const frameURL of [
    'http://localhost:5173/',
    'http://localhost:5173/#/sessions',
    'http://localhost:5173/#/tickets',
  ])
    assert.equal(isRendererDocument(frameURL, 'http://localhost:5173'), true, frameURL)
})

test('a child frame is not the trusted renderer document', () => {
  assert.equal(
    isRendererDocument('http://localhost:5173/child.html', 'http://localhost:5173'),
    false,
  )
})

test('a foreign WebContents or child frame is refused', () => {
  const window = { webContents: { id: 7 } } as never
  const trusted = { sender: { id: 7 }, senderFrame: { url: 'http://localhost:5173/' } } as never
  const child = {
    sender: { id: 7 },
    senderFrame: { url: 'http://localhost:5173/child.html' },
  } as never
  const foreignWindow = {
    sender: { id: 8 },
    senderFrame: { url: 'http://localhost:5173/' },
  } as never

  assert.equal(isTrustedRendererFrame(trusted, window, 'http://localhost:5173'), true)
  assert.equal(isTrustedRendererFrame(child, window, 'http://localhost:5173'), false)
  assert.equal(isTrustedRendererFrame(foreignWindow, window, 'http://localhost:5173'), false)
})

test('a packaged renderer is trusted on every route', () => {
  const rendererURL = 'file:///Applications/Argo.app/Contents/Resources/app.asar/index.html'
  assert.equal(isRendererDocument(`${rendererURL}#/sessions`, rendererURL), true)
  assert.equal(
    isRendererDocument('file:///tmp/foreign.html', rendererURL),
    false,
  )
})

test('a document other than the renderer is refused', () => {
  for (const frameURL of [
    'http://localhost:5174/',
    'http://localhost:5173/other.html',
    'https://localhost:5173/',
    'http://example.com/',
    'file:///Applications/Argo.app/Contents/Resources/app.asar/index.html',
    'not a url',
  ])
    assert.equal(isRendererDocument(frameURL, 'http://localhost:5173'), false, frameURL)
})
