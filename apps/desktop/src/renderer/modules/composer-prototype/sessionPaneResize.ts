export const SESSION_PANE_MIN_WIDTH = 216
export const SESSION_PANE_SNAP_TOLERANCE = 24

const reachedSnapEdge = (width: number, previousWidth: number) =>
  width <= SESSION_PANE_MIN_WIDTH + SESSION_PANE_SNAP_TOLERANCE && width < previousWidth

export const shouldCloseSessionInspector = (inspectorWidth: number, previousInspectorWidth: number) =>
  inspectorWidth > 0 && reachedSnapEdge(inspectorWidth, previousInspectorWidth)

export const shouldFullscreenSessionInspector = (feedWidth: number, previousFeedWidth: number) =>
  reachedSnapEdge(feedWidth, previousFeedWidth)

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
