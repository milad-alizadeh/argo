export const SESSION_FEED_MIN_WIDTH = 360
export const SESSION_ROSTER_MIN_WIDTH = 300
export const SESSION_INSPECTOR_MIN_WIDTH = 240

export const paneContentVisibilityClass = (visible: boolean) =>
  visible ? '' : 'pointer-events-none'

export const nextPaneContentWidth = (
  panelWidth: number,
  previousContentWidth: number,
  minimumWidth: number,
) => (panelWidth > 0 ? Math.max(panelWidth, minimumWidth) : previousContentWidth)
