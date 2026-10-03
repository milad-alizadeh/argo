export const TERMINAL_OUTPUT_PROVENANCE = {
  producer: 'anser',
  version: '2.3.5',
  recordedAt: '2026-10-03',
  source: 'Synthetic SGR inputs rendered through the installed engine, not Harness recordings.',
  engineSha256: 'd1aa5e4bdb0450757a17e9445b38b23dcfeb695ac16086ee895021c9ccfb1f09',
} as const

export const terminalOutputCases = {
  trueColor: '\u001b[38;2;12;34;56;48;2;210;220;230mtrue color\u001b[0m',
  protocol: '\u001b[31;104mprotocol pair\u001b[0m',
  indexed: '\u001b[38;5;196;48;5;226mindexed pair\u001b[0m',
  editing: 'old\b\bNEW\rreplace\n',
  decorations:
    '\u001b[1mbold output\u001b[22m\n\u001b[2mdim output\u001b[22m\n\u001b[1;2mlast decoration wins\u001b[0m\nplain output\n',
  indexedReadable: '\u001b[38;5;16;48;5;226mindexed yellow output\u001b[0m\n',
  explicitGrounds: '\u001b[37;40mwhite on black\u001b[0m\n\u001b[30;47mblack on white\u001b[0m\n',
} as const

export const recordedTrueColorEmission = {
  content: 'true color',
  fg: 'ansi-truecolor',
  bg: 'ansi-truecolor',
  fg_truecolor: '12, 34, 56',
  bg_truecolor: '210, 220, 230',
  decoration: null,
  decorations: [],
} as const

const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const
export const terminalPaletteOutput = colors
  .flatMap((name, index) => [
    `\u001b[${30 + index}m${name} foreground\u001b[0m\n`,
    `\u001b[${90 + index}mbright ${name} foreground\u001b[0m\n`,
    `\u001b[${40 + index}m        \u001b[0m ${name} background\n`,
    `\u001b[${100 + index}m        \u001b[0m bright ${name} background\n`,
  ])
  .join('')

export const terminalProtocolOutput = [
  terminalPaletteOutput,
  terminalOutputCases.indexedReadable,
  terminalOutputCases.explicitGrounds,
  terminalOutputCases.trueColor,
  '\n',
  terminalOutputCases.decorations,
].join('')

export const longTerminalOutput = `${Array.from(
  { length: 120 },
  (_, index) => `Build step ${index + 1}: processed src/components/component-${index + 1}.tsx\n`,
).join('')}Build complete\n`
