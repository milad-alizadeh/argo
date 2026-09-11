export const SESSION_FEED_MIN_WIDTH = 360
export const SESSION_SIDEBAR_MIN_WIDTH = 216
export const SESSION_PANE_SNAP_RESISTANCE = 80
export const SESSION_FEED_SNAP_WIDTH = SESSION_FEED_MIN_WIDTH - SESSION_PANE_SNAP_RESISTANCE
export const SESSION_SIDEBAR_SNAP_WIDTH = SESSION_SIDEBAR_MIN_WIDTH - SESSION_PANE_SNAP_RESISTANCE

export const paneContentVisibilityClass = (visible: boolean) => visible ? '' : 'pointer-events-none'

export const shouldSnapSessionPane = (width: number, previousWidth: number, minimumWidth: number) =>
  width > 0
  && width <= minimumWidth - SESSION_PANE_SNAP_RESISTANCE
  && width < previousWidth

export const shouldDeferSessionInspectorCollapse = ({
  visible,
  fullscreen,
}: {
  visible: boolean
  fullscreen: boolean
}) => !visible && fullscreen

export const restoreWidthAfterFullscreenSnap = ({
  currentRestoreWidth,
  feedWidthAtSnap,
  inspectorWidthAtSnap,
}: {
  currentRestoreWidth: number
  feedWidthAtSnap: number
  inspectorWidthAtSnap: number
}) => inspectorWidthAtSnap > SESSION_SIDEBAR_MIN_WIDTH
  ? feedWidthAtSnap + inspectorWidthAtSnap - SESSION_FEED_MIN_WIDTH
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
  && feedWidth > SESSION_FEED_SNAP_WIDTH
  && inspectorWidth > SESSION_SIDEBAR_SNAP_WIDTH
