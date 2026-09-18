import type { SessionSetup } from './models'
import type { TranscriptMessage, TranscriptRecord } from './transcript'

type SetupState = { setup: SessionSetup; pendingTurnSetup: boolean }

const EMPTY_SETUP: SessionSetup = { model: null, effort: null, mode: null }

function changedSetup(state: SetupState, record: Extract<TranscriptRecord, { kind: 'setup' }>) {
  const setup = record.startsTurn
    ? { model: record.model, effort: record.effort, mode: record.mode }
    : {
        model: record.model ?? state.setup.model,
        effort: record.effort ?? state.setup.effort,
        mode: record.mode ?? state.setup.mode,
      }
  return { setup, pendingTurnSetup: record.startsTurn }
}

function promptSetup(state: SetupState, record: TranscriptMessage): SetupState {
  return {
    setup: {
      model: state.pendingTurnSetup ? state.setup.model : null,
      effort: state.pendingTurnSetup ? state.setup.effort : null,
      mode: record.mode ?? state.setup.mode,
    },
    pendingTurnSetup: false,
  }
}

function messageSetup(state: SetupState, record: TranscriptMessage): SetupState {
  const prompt = record.role === 'user' && record.answeredCalls.length === 0
  if (prompt) return promptSetup(state, record)
  if (record.role !== 'assistant') return state
  return {
    ...state,
    setup: {
      model: record.model ?? state.setup.model,
      effort: record.effort ?? state.setup.effort,
      mode: state.setup.mode,
    },
  }
}

export function readSetup(records: readonly TranscriptRecord[]): SessionSetup {
  return records.reduce<SetupState>(
    (state, record) => {
      if (record.kind === 'setup') return changedSetup(state, record)
      return record.kind === 'message' ? messageSetup(state, record) : state
    },
    { setup: EMPTY_SETUP, pendingTurnSetup: false },
  ).setup
}
