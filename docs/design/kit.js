// Render functions for shapes a design page repeats. A design page names its regions with
// data-component and draws them from here, so a shape is specified once and every state render
// shows the same one. A classic script, not a module: a file:// page cannot import one.
globalThis.designKit = {
  /** One sidebar destination row: the shape the shell repeats five times. */
  navigationRow({ label, selected = false }) {
    const row = document.createElement('button')
    row.type = 'button'
    row.dataset.component = 'NavigationRow'
    row.setAttribute('aria-current', selected ? 'page' : 'false')
    const glyph = document.createElement('span')
    glyph.className = 'glyph'
    row.append(glyph, label)
    return row
  },
}
