import { createContext, type ReactNode, useContext } from 'react'
import type { ExtraProps } from 'react-markdown'
import { FeedGallery, FeedImage } from './FeedImages'

type MarkdownNode = ExtraProps['node']

// True inside a paragraph drawn as a gallery, so its images do not each open their own row.
const InGallery = createContext(false)

function elementsOf(node: MarkdownNode) {
  return (node?.children ?? []).filter(
    (child) => child.type === 'element' || (child.type === 'text' && child.value.trim() !== ''),
  )
}

function holdsOnlyImages(node: MarkdownNode) {
  const children = elementsOf(node)
  return (
    children.length > 0 &&
    children.every((child) => child.type === 'element' && child.tagName === 'img')
  )
}

function holdsImage(node: MarkdownNode) {
  return elementsOf(node).some((child) => child.type === 'element' && child.tagName === 'img')
}

// A paragraph of only images draws as a gallery; one mixing text and images is a plain `div`,
// since a `p` cannot hold the gallery's `div`.
export function GalleryParagraph({
  node,
  children,
}: {
  node?: MarkdownNode
  children?: ReactNode
}) {
  if (holdsOnlyImages(node))
    return (
      <InGallery.Provider value={true}>
        <FeedGallery>{children}</FeedGallery>
      </InGallery.Provider>
    )
  if (holdsImage(node)) return <div>{children}</div>
  return <p>{children}</p>
}

export function GalleryImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  const inGallery = useContext(InGallery)
  const source = typeof src === 'string' ? src : ''
  const image = <FeedImage key={source} source={source} alt={alt ?? ''} />
  return inGallery ? image : <FeedGallery>{image}</FeedGallery>
}
