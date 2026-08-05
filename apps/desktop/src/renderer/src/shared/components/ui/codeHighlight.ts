import { createCssVariablesTheme, createHighlighterCoreSync, type ThemedToken } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import css from '@shikijs/langs/css'
import json from '@shikijs/langs/json'
import markdown from '@shikijs/langs/markdown'
import shellscript from '@shikijs/langs/shellscript'
import tsx from '@shikijs/langs/tsx'

// Syntax highlighting for the two patch surfaces, SYNCHRONOUS and offline.
//
// Three deliberate narrowings, each of which is what keeps a highlighter out of the way of a feed
// that scrolls:
//
// 1. `createHighlighterCoreSync` over the async bundle. A diff renders inside a list; an await in
//    that path means every patch on the surface flashes unstyled before it settles, and a feed of
//    fifty of them flashes fifty times.
// 2. The JavaScript regex engine over oniguruma's WASM. No binary to fetch, no init to await, and
//    nothing for a packaged Electron build to fail to locate at runtime.
// 3. Five grammars, not the bundled two hundred. These are the languages this repo's agents
//    actually edit; anything else renders as plain text, which is the honest floor — a grammar
//    guessed at colours the code wrong, and wrong colour is worse than none.
//
// The THEME is `createCssVariablesTheme`, so every token resolves to an argo token rather than to
// a vendored VS Code palette. That is what keeps a diff on the cockpit's own palette and what
// makes it follow the light/dark switch — the variables are defined once, in globals.css.

/** The grammars carried, keyed by the extensions that reach them. `tsx` covers the whole
 * JS family: its grammar is a superset, so one entry highlights `.ts`, `.js` and `.mjs` too. */
const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: 'tsx',
  tsx: 'tsx',
  mts: 'tsx',
  cts: 'tsx',
  js: 'tsx',
  jsx: 'tsx',
  mjs: 'tsx',
  cjs: 'tsx',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  md: 'markdown',
  mdx: 'markdown',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
}

const THEME = 'argo-css-variables'

const highlighter = createHighlighterCoreSync({
  themes: [createCssVariablesTheme({ name: THEME, variablePrefix: '--shiki-' })],
  langs: [tsx, json, css, markdown, shellscript],
  engine: createJavaScriptRegexEngine(),
})

/** Which grammar a path is read with, or `null` for one this app carries none for. Absent rather
 * than defaulted to a guess: the wrong grammar mis-colours real code, and a mis-coloured string
 * literal is a reader misled about what the diff says. */
export function languageOf(path: string | null): string | null {
  const extension = path?.toLowerCase().split('.').at(-1) ?? ''
  return LANGUAGE_BY_EXTENSION[extension] ?? null
}

/** One line's worth of coloured pieces. */
export type CodeToken = Pick<ThemedToken, 'content' | 'color'>

/**
 * A block of code as one array of coloured tokens per line, index-aligned with the lines handed in.
 *
 * The block is tokenized WHOLE rather than a line at a time, because a grammar is stateful: a block
 * comment, a template literal and a fenced string all begin on one line and end on another, and a
 * per-line highlighter reopens the file's context at every row — which colours the second half of
 * every multi-line string as if it were code.
 *
 * A patch is a lossy input for that: its context lines are real, but the code between two hunks is
 * missing, so a construct opened before the hunk starts is not in what we tokenize. The result is
 * still right far more often than per-line would be, and it is never wrong in a way that changes
 * what the text SAYS — only how it is tinted.
 */
export function highlightLines(lines: readonly string[], language: string | null): CodeToken[][] {
  if (language === null) return lines.map((line) => [{ content: line, color: undefined }])
  const { tokens } = highlighter.codeToTokens(lines.join('\n'), { lang: language, theme: THEME })
  // A trailing newline or a grammar that folds lines can leave the two out of step; the text is
  // what must survive, so any line the tokenizer did not return falls back to itself uncoloured.
  return lines.map((line, index) => tokens[index] ?? [{ content: line, color: undefined }])
}
