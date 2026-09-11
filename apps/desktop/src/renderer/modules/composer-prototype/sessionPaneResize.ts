export const SESSION_FEED_MIN_WIDTH = 360
export const SESSION_ROSTER_MIN_WIDTH = 300
export const SESSION_INSPECTOR_MIN_WIDTH = 240
export const SESSION_ROSTER_COLLAPSE_MEDIA = '(max-width: 61.25rem)'

export const paneContentVisibilityClass = (visible: boolean) =>
  visible ? '' : 'pointer-events-none'
