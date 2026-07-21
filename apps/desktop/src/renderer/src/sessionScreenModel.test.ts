import { sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import type { SessionView } from '@/sessionStore'
import { stateMatrixInput } from '@/shared/delivery'
import { buildSessionPanel, type PanelUiState } from './sessionScreenModel'

const DEFAULT_UI: PanelUiState = {
  variant: 'split',
  openNode: null,
  tab: 'changes',
  changesView: 'all',
  activeChannel: 'live',
}

const sessionFrom = (id: string): SessionView => ({
  id,
  title: `Session ${id}`,
  cli: 'claude',
  facts: sessionFacts(stateMatrixInput(id)),
})

describe('buildSessionPanel', () => {
  it('derives the delivery lifecycle via deliveryState (S1 → head on commits)', () => {
    const panel = buildSessionPanel({
      session: sessionFrom('S1'),
      ui: DEFAULT_UI,
      consoleExpanded: false,
    })
    expect(panel.delivery.lifecycle).not.toBeNull()
    expect(panel.delivery.lifecycle?.head).toBe('commits')
  })

  it('lands the merged terminal for a merged Session (S10)', () => {
    const panel = buildSessionPanel({
      session: sessionFrom('S10'),
      ui: DEFAULT_UI,
      consoleExpanded: false,
    })
    expect(panel.delivery.lifecycle?.terminal).toBe('merged')
  })

  it('holds honest-empty defaults when no rich data is supplied', () => {
    const panel = buildSessionPanel({
      session: sessionFrom('S6'),
      ui: DEFAULT_UI,
      consoleExpanded: false,
    })
    expect(panel.header.project).toBe('argo')
    expect(panel.header.workspace).toBeNull()
    expect(panel.activity.actors).toEqual([])
    expect(panel.activity.nowLine).toBeNull()
    expect(panel.delivery.pr).toBeNull()
    expect(panel.console.capture).toBeUndefined()
    // The console defaults to the live channel — no capture fabricated.
    expect(panel.console.activeChannel).toBe('live')
  })

  it('threads the UI state onto the delivery and console slices', () => {
    const panel = buildSessionPanel({
      session: sessionFrom('S6'),
      ui: { ...DEFAULT_UI, variant: 'solo', tab: 'review' },
      consoleExpanded: true,
    })
    expect(panel.variant).toBe('solo')
    expect(panel.delivery.tab).toBe('review')
    expect(panel.console.expanded).toBe(true)
  })
})
