import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  shouldCloseSessionInspector,
  shouldFullscreenSessionInspector,
  shouldRememberSessionInspectorWidth,
} from './sessionPaneResize'

test('dragging the inspector to its minimum snaps it closed in the same gesture', () => {
  assert.equal(shouldCloseSessionInspector(216, 224), true)
})

test('dragging the feed to its minimum snaps the inspector fullscreen in the same gesture', () => {
  assert.equal(shouldFullscreenSessionInspector(216, 224), true)
})

test('dragging away from an edge does not snap either pane', () => {
  assert.equal(shouldCloseSessionInspector(224, 216), false)
  assert.equal(shouldFullscreenSessionInspector(224, 216), false)
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
})

test('snap transitions and programmatic changes do not replace the last split width', () => {
  assert.equal(
    shouldRememberSessionInspectorWidth({
      feedWidth: 216,
      inspectorWidth: 784,
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
