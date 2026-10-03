import { expect, test } from 'bun:test'
import anserPackage from 'anser/package.json'
import {
  recordedTrueColorEmission,
  TERMINAL_OUTPUT_PROVENANCE,
  terminalOutputCases,
} from '../../../../../mocks/sessions/terminal-output'
import { formatTerminalOutput } from './terminal-format'

test('records the installed engine version for the synthetic protocol fixtures', () => {
  expect(anserPackage.version).toBe(TERMINAL_OUTPUT_PROVENANCE.version)
})

test('preserves source true-color foreground and background data', () => {
  const [run] = formatTerminalOutput(terminalOutputCases.trueColor)
  expect(run?.foreground?.kind === 'rgb' ? run.foreground.channels.join(', ') : null).toBe(
    recordedTrueColorEmission.fg_truecolor,
  )
  expect(run?.background?.kind === 'rgb' ? run.background.channels.join(', ') : null).toBe(
    recordedTrueColorEmission.bg_truecolor,
  )
  expect(formatTerminalOutput(terminalOutputCases.trueColor)).toEqual([
    {
      text: 'true color',
      foreground: { kind: 'rgb', channels: [12, 34, 56] },
      background: { kind: 'rgb', channels: [210, 220, 230] },
      decoration: null,
    },
  ])
})

test('retains the last-decoration policy and resets emphasis', () => {
  expect(
    formatTerminalOutput(terminalOutputCases.decorations).map((run) => ({
      text: run.text,
      decoration: run.decoration,
    })),
  ).toEqual([
    { text: 'bold output', decoration: 'bold' },
    { text: '\n', decoration: null },
    { text: 'dim output', decoration: 'dim' },
    { text: '\n', decoration: null },
    { text: 'last decoration wins', decoration: 'dim' },
    { text: '\nplain output\n', decoration: null },
  ])
})

test('resets true color without applying retained engine metadata to later text', () => {
  const source = '\u001b[38;2;12;34;56mfirst\u001b[39mplain\u001b[31mprotocol\u001b[0m'
  expect(formatTerminalOutput(source).map((run) => run.foreground)).toEqual([
    { kind: 'rgb', channels: [12, 34, 56] },
    null,
    { kind: 'protocol', name: 'red' },
  ])
})

test('keeps protocol identities separate from extended indexed RGB data', () => {
  expect(formatTerminalOutput(terminalOutputCases.protocol)).toEqual([
    {
      text: 'protocol pair',
      foreground: { kind: 'protocol', name: 'red' },
      background: { kind: 'protocol', name: 'bright-blue' },
      decoration: null,
    },
  ])
  expect(formatTerminalOutput(terminalOutputCases.indexed)).toEqual([
    {
      text: 'indexed pair',
      foreground: { kind: 'rgb', channels: [255, 0, 0] },
      background: { kind: 'rgb', channels: [255, 255, 0] },
      decoration: null,
    },
  ])
})

test('retains the existing backspace and carriage-return preprocessing', () => {
  expect(formatTerminalOutput(terminalOutputCases.editing)).toEqual([
    { text: 'replace\n', foreground: null, background: null, decoration: null },
  ])
  expect(
    formatTerminalOutput('abc\b\bX\nline\rnext\n')
      .map((run) => run.text)
      .join(''),
  ).toBe('aX\nnext\n')
})

test('keeps malformed RGB and indexed output readable', () => {
  expect(formatTerminalOutput('\u001b[38;2;999;0;0mmalformed RGB\u001b[0m')).toEqual([
    { text: 'malformed RGB', foreground: null, background: null, decoration: null },
  ])
  expect(formatTerminalOutput('\u001b[48;5;256mmalformed index\u001b[0m')).toEqual([
    { text: 'malformed index', foreground: null, background: null, decoration: null },
  ])
  expect(formatTerminalOutput('\u001b[38;2;1;2mincomplete RGB\u001b[0m')).toEqual([
    { text: 'incomplete RGB', foreground: null, background: null, decoration: 'dim' },
  ])
})

test('preserves explicit black and white protocol pairs', () => {
  expect(
    formatTerminalOutput(terminalOutputCases.explicitGrounds).filter(
      (run) => run.foreground !== null,
    ),
  ).toEqual([
    {
      text: 'white on black',
      foreground: { kind: 'protocol', name: 'white' },
      background: { kind: 'protocol', name: 'black' },
      decoration: null,
    },
    {
      text: 'black on white',
      foreground: { kind: 'protocol', name: 'black' },
      background: { kind: 'protocol', name: 'white' },
      decoration: null,
    },
  ])
})
