export const SESSION_PANE_MIN_WIDTH = 216
export const SESSION_PANE_SNAP_TOLERANCE = 24

const reachedSnapEdge = (width: number, previousWidth: number) =>
  width <= SESSION_PANE_MIN_WIDTH + SESSION_PANE_SNAP_TOLERANCE && width < previousWidth

export const shouldCollapseSessionPane = (paneWidth: number, previousPaneWidth: number) =>
  paneWidth > 0 && reachedSnapEdge(paneWidth, previousPaneWidth)

export const shouldFullscreenSessionInspector = (feedWidth: number, previousFeedWidth: number) =>
  reachedSnapEdge(feedWidth, previousFeedWidth)

export const restoreWidthAfterFullscreenSnap = ({
  currentRestoreWidth,
  feedWidthAtSnap,
  inspectorWidthAtSnap,
}: {
  currentRestoreWidth: number
  feedWidthAtSnap: number
  inspectorWidthAtSnap: number
}) => inspectorWidthAtSnap > SESSION_PANE_MIN_WIDTH
  ? feedWidthAtSnap + inspectorWidthAtSnap - SESSION_PANE_MIN_WIDTH
  : currentRestoreWidth

export const shouldRememberSessionInspectorWidth = ({
  feedWidth,
  inspectorWidth,
  isUserInteraction,
}: {
  feedWidth: number
  inspectorWidth: number
  isUserInteraction: boolean
}) =>
  isUserInteraction
  && feedWidth > SESSION_PANE_MIN_WIDTH + SESSION_PANE_SNAP_TOLERANCE
  && inspectorWidth > SESSION_PANE_MIN_WIDTH + SESSION_PANE_SNAP_TOLERANCE
