import { defaultUrlTransform, type UrlTransform } from 'react-markdown'
import { isExternalLink, loadableImageSource } from '@/platform/shared/urls'

// Replaces react-markdown's own filter, which drops `data:` and `file:` images. A link that can
// open neither in the browser nor, as an absolute path, in the inspector becomes '' and draws as text.
export const feedUrlTransform: UrlTransform = (value, key) => {
  if (key === 'src') return loadableImageSource(value)
  if (key === 'href') return isExternalLink(value) || value.startsWith('/') ? value : ''
  return defaultUrlTransform(value)
}
