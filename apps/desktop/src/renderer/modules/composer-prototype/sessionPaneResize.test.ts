import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  paneContentVisibilityClass,
  SESSION_FEED_MIN_WIDTH,
  SESSION_INSPECTOR_MIN_WIDTH,
  SESSION_ROSTER_COLLAPSE_MEDIA,
  SESSION_ROSTER_MIN_WIDTH,
} from './sessionPaneResize'

test('a collapsed pane prevents interaction with clipped content', () => {
  assert.equal(paneContentVisibilityClass(false), 'pointer-events-none')
})

test('feed and sidebar preserve their readable minimum widths', () => {
  assert.equal(SESSION_FEED_MIN_WIDTH, 360)
  assert.equal(SESSION_ROSTER_MIN_WIDTH, 300)
  assert.equal(SESSION_INSPECTOR_MIN_WIDTH, 240)
  assert.equal(SESSION_ROSTER_COLLAPSE_MEDIA, '(max-width: 61.25rem)')
})
