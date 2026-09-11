import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  restoreWidthAfterFullscreenSnap,
  shouldDeferSessionInspectorCollapse,
  shouldRememberSessionInspectorWidth,
  shouldSnapSessionPane,
} from './sessionPaneResize'

test('closing after a left snap reopens with the feed at its minimum width', () => {
  assert.equal(
    restoreWidthAfterFullscreenSnap({
      currentRestoreWidth: 248,
      feedWidthAtSnap: 192,
      inspectorWidthAtSnap: 808,
    }),
    784,
  )
})

test('a pane resists through the offset after reaching its content minimum', () => {
  assert.equal(shouldSnapSessionPane(216, 224), false)
  assert.equal(shouldSnapSessionPane(193, 216), false)
  assert.equal(shouldSnapSessionPane(192, 193), true)
})

test('closing a fullscreen inspector defers collapse until the split panel remounts', () => {
  assert.equal(shouldDeferSessionInspectorCollapse({ visible: false, fullscreen: true }), true)
  assert.equal(shouldDeferSessionInspectorCollapse({ visible: false, fullscreen: false }), false)
  assert.equal(shouldDeferSessionInspectorCollapse({ visible: true, fullscreen: true }), false)
})

test('dragging away from an edge does not snap either pane', () => {
  assert.equal(shouldSnapSessionPane(224, 216), false)
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
      feedWidth: 216,
      inspectorWidth: 784,
      isUserInteraction: true,
    }),
    true,
  )
})

test('snap transitions and programmatic changes do not replace the last split width', () => {
  assert.equal(
    shouldRememberSessionInspectorWidth({
      feedWidth: 192,
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
