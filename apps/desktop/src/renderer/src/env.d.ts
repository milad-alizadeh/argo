/// <reference types="vite/client" />

// `-webkit-app-region` is real CSS in Chromium but absent from csstype, so React's
// CSSProperties rejects it. Declared here rather than asserted at the use site: it is the only
// way a frameless (`hiddenInset`) window stays draggable — design-system.md escape hatch 2.
// The spine's three screen-local layout px, written as custom properties by whichever View owns the
// splitters (`SessionScreen`, and the roster stories' decorator). Declared here for the same reason
// as the line above: csstype knows no custom property, and the alternative is an `as` at every use
// site — which rules/typescript-style.md does not sanction.
declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag'
    '--c-rail'?: string
    '--c-act'?: string
    '--r-term'?: string
  }
}
