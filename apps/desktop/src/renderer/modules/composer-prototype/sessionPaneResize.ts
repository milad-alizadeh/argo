export const SESSION_PANE_MIN_WIDTH = 216
export const SESSION_PANE_SNAP_OFFSET = 24
export const SESSION_PANE_SNAP_WIDTH = SESSION_PANE_MIN_WIDTH - SESSION_PANE_SNAP_OFFSET

export const paneContentVisibilityClass = (visible: boolean) => visible ? '' : 'pointer-events-none'

export const shouldSnapSessionPane = (width: number, previousWidth: number) =>
  width > 0 && width <= SESSION_PANE_SNAP_WIDTH && width < previousWidth

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
  && feedWidth > SESSION_PANE_SNAP_WIDTH
  && inspectorWidth > SESSION_PANE_SNAP_WIDTH
