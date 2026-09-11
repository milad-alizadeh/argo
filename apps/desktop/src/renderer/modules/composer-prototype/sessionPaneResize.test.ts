import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  nextPaneContentWidth,
  paneContentVisibilityClass,
  SESSION_FEED_MIN_WIDTH,
  SESSION_SIDEBAR_MIN_WIDTH,
} from './sessionPaneResize'

test('pane content follows the handle after reversing a collapse drag', () => {
  const minimumWidth = 216
  const atMinimum = nextPaneContentWidth(216, 280, minimumWidth)
  const whileCollapsed = nextPaneContentWidth(0, atMinimum, minimumWidth)
  const afterReversing = nextPaneContentWidth(260, whileCollapsed, minimumWidth)

  assert.equal(atMinimum, 216)
  assert.equal(whileCollapsed, 216)
  assert.equal(afterReversing, 260)
})

test('a snapped pane keeps its fixed-width content visible until clipping closes it', () => {
  assert.equal(paneContentVisibilityClass(false), 'pointer-events-none')
})

test('feed and sidebar preserve their readable minimum widths', () => {
  assert.equal(SESSION_FEED_MIN_WIDTH, 360)
  assert.equal(SESSION_SIDEBAR_MIN_WIDTH, 216)
})
