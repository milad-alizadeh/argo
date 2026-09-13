import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isRendererDocument } from './is-trusted-renderer-frame'

test('the dev-server renderer is trusted on every route', () => {
  for (const frameURL of [
    'http://localhost:5173/',
    'http://localhost:5173/#/sessions',
    'http://localhost:5173/#/tickets',
  ])
    assert.equal(isRendererDocument(frameURL, 'http://localhost:5173'), true, frameURL)
})

test('a packaged renderer is trusted on every route', () => {
  const rendererURL = 'file:///Applications/Argo.app/Contents/Resources/app.asar/index.html'
  assert.equal(isRendererDocument(`${rendererURL}#/sessions`, rendererURL), true)
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
