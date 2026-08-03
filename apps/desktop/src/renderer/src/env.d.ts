/// <reference types="vite/client" />

// `-webkit-app-region` is real CSS in Chromium but absent from csstype, so React's
// CSSProperties rejects it. Declared here rather than asserted at the use site: it is the only
// way a frameless (`hiddenInset`) window stays draggable — design-system.md escape hatch 2.
declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
