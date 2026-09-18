// The one place the renderer mints a request identifier, so a reply that answers a different
// request is caught by the client rather than by a component.
export const nextRequestId = (): string => `request-${crypto.randomUUID()}`
