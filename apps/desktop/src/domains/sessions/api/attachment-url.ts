export const ATTACHMENT_SCHEME = 'argo-attachment'
export const ATTACHMENT_HOST = 'local'

export function attachmentPathFromUrl(url: string): string | null {
  const prefix = `${ATTACHMENT_SCHEME}://${ATTACHMENT_HOST}`
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null
}
