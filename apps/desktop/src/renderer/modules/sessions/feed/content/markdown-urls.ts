import { defaultUrlTransform, type UrlTransform } from 'react-markdown'
import { isExternalLink, loadableImageSource } from '@/core/security/urls'

// Replaces react-markdown's own filter, which drops `data:` and `file:` images. A link that cannot
// open in the browser becomes '' and draws as text.
export const feedUrlTransform: UrlTransform = (value, key) => {
  if (key === 'src') return loadableImageSource(value)
  if (key === 'href') return isExternalLink(value) ? value : ''
  return defaultUrlTransform(value)
}
