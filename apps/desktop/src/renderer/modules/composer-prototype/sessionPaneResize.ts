export const SESSION_FEED_MIN_WIDTH = 360
export const SESSION_SIDEBAR_MIN_WIDTH = 216

export const paneContentVisibilityClass = (visible: boolean) => visible ? '' : 'pointer-events-none'

export const nextPaneContentWidth = (
  panelWidth: number,
  previousContentWidth: number,
  minimumWidth: number,
) => panelWidth > 0 ? Math.max(panelWidth, minimumWidth) : previousContentWidth
