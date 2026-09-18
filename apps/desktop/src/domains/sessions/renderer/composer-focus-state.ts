// The `location.state` a freshly started Session's navigate carries, so its composer knows to
// focus itself once mounted. Its own module so a call site that only routes on this string, such
// as a Send's start-new-Session path, does not have to import the composer's React tree to read it.
export const COMPOSER_FOCUS_STATE = 'focus-composer'
