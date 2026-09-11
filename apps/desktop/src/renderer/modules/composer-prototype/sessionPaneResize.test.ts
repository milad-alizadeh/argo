import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  paneContentVisibilityClass,
  restoreWidthAfterFullscreenSnap,
  SESSION_FEED_MIN_WIDTH,
  SESSION_PANE_SNAP_RESISTANCE,
  SESSION_SIDEBAR_MIN_WIDTH,
  shouldDeferSessionInspectorCollapse,
  shouldRememberSessionInspectorWidth,
  shouldSnapSessionPane,
} from './sessionPaneResize'

test('a snapped pane keeps its fixed-width content visible until clipping closes it', () => {
  assert.equal(paneContentVisibilityClass(false), 'pointer-events-none')
})

test('closing after a left snap reopens with the feed at its minimum width', () => {
  assert.equal(
    restoreWidthAfterFullscreenSnap({
      currentRestoreWidth: 248,
      feedWidthAtSnap: 280,
      inspectorWidthAtSnap: 808,
    }),
    728,
  )
})

test('feed and sidebar require deliberate overdrag before advancing to their next snap point', () => {
  assert.equal(SESSION_FEED_MIN_WIDTH, 360)
  assert.equal(SESSION_SIDEBAR_MIN_WIDTH, 216)
  assert.equal(SESSION_PANE_SNAP_RESISTANCE, 80)
  assert.equal(shouldSnapSessionPane(360, 368, SESSION_FEED_MIN_WIDTH), false)
  assert.equal(shouldSnapSessionPane(281, 360, SESSION_FEED_MIN_WIDTH), false)
  assert.equal(shouldSnapSessionPane(280, 281, SESSION_FEED_MIN_WIDTH), true)
  assert.equal(shouldSnapSessionPane(216, 224, SESSION_SIDEBAR_MIN_WIDTH), false)
  assert.equal(shouldSnapSessionPane(137, 216, SESSION_SIDEBAR_MIN_WIDTH), false)
  assert.equal(shouldSnapSessionPane(136, 137, SESSION_SIDEBAR_MIN_WIDTH), true)
})

test('closing a fullscreen inspector defers collapse until the split panel remounts', () => {
  assert.equal(shouldDeferSessionInspectorCollapse({ visible: false, fullscreen: true }), true)
  assert.equal(shouldDeferSessionInspectorCollapse({ visible: false, fullscreen: false }), false)
  assert.equal(shouldDeferSessionInspectorCollapse({ visible: true, fullscreen: true }), false)
})

test('dragging away from an edge does not snap either pane', () => {
  assert.equal(shouldSnapSessionPane(224, 216, SESSION_SIDEBAR_MIN_WIDTH), false)
})

test('a completed split resize is remembered away from both snap edges', () => {
  assert.equal(
    shouldRememberSessionInspectorWidth({
      feedWidth: 640,
      inspectorWidth: 360,
      isUserInteraction: true,
    }),
    true,
  )
  assert.equal(
    shouldRememberSessionInspectorWidth({
      feedWidth: 360,
      inspectorWidth: 728,
      isUserInteraction: true,
    }),
    true,
  )
})

test('snap transitions and programmatic changes do not replace the last split width', () => {
  assert.equal(
    shouldRememberSessionInspectorWidth({
      feedWidth: 280,
      inspectorWidth: 808,
      isUserInteraction: true,
    }),
    false,
  )
  assert.equal(
    shouldRememberSessionInspectorWidth({
      feedWidth: 640,
      inspectorWidth: 360,
      isUserInteraction: false,
    }),
    false,
  )
})
