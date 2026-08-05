import { describe, expect, it } from 'vitest'
import { textPieces } from './linkify'

// What counts as a link in a line of prose. The hard half is not FINDING the URL — it is where the
// address stops and the sentence resumes, which is the difference between a link that opens and a
// link that 404s.

const hrefs = (value: string): (string | null)[] => textPieces(value).map((piece) => piece.href)

describe('a bare URL in running text', () => {
  it('is found without any markup around it', () => {
    expect(hrefs('see https://example.com/x for more')).toEqual([
      null,
      'https://example.com/x',
      null,
    ])
  })

  it('keeps the text either side of it verbatim, so nothing is lost to the split', () => {
    expect(textPieces('see https://example.com now').map((piece) => piece.text)).toEqual([
      'see ',
      'https://example.com',
      ' now',
    ])
  })

  it('finds every URL on the line, not just the first', () => {
    expect(hrefs('https://a.test and https://b.test')).toEqual([
      'https://a.test',
      null,
      'https://b.test',
    ])
  })
})

describe('where the address stops', () => {
  // The full stop ended the sentence, not the path — and a link carrying it does not resolve. It
  // comes back as TEXT rather than being deleted: the sentence still ends with a full stop.
  it('drops sentence punctuation that trails the URL, keeping it as text', () => {
    expect(textPieces('read https://example.com/docs.')).toEqual([
      { text: 'read ', href: null, at: 0 },
      { text: 'https://example.com/docs', href: 'https://example.com/docs', at: 5 },
      { text: '.', href: null, at: 29 },
    ])
  })

  it('drops a closing paren the URL did not open', () => {
    expect(hrefs('(https://example.com/x)')).toEqual([null, 'https://example.com/x', null])
  })

  // The other direction, and the reason the paren rule is conditional rather than absolute: a
  // wiki-style path ends in a paren that IS part of the address.
  it('keeps a closing paren the URL did open', () => {
    expect(hrefs('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual([
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    ])
  })

  it('stops at whitespace rather than running into the next word', () => {
    expect(textPieces('https://a.test then text')[0]?.text).toBe('https://a.test')
  })
})

describe('where each piece came from', () => {
  // The offset is the list key the prompt row renders by: unique by construction where the TEXT is
  // not, since one prompt can carry the same URL twice.
  it('carries each piece’s own offset, so a repeated URL is still two pieces', () => {
    const pieces = textPieces('https://a.test x https://a.test')

    expect(pieces.map((piece) => piece.at)).toEqual([0, 14, 17])
    expect(new Set(pieces.map((piece) => piece.at)).size).toBe(pieces.length)
  })
})

describe('what is not a link', () => {
  it('leaves a line with no URL as one plain piece', () => {
    expect(textPieces('nothing to see here')).toEqual([
      { text: 'nothing to see here', href: null, at: 0 },
    ])
  })

  // Only the two schemes a browser should be handed. A `file:` or `javascript:` destination is
  // never made clickable here — the prose renderer refuses those too, and this is the earlier gate.
  it('ignores schemes other than http and https', () => {
    expect(hrefs('file:///etc/passwd and javascript:alert(1)')).toEqual([null])
  })

  it('leaves an empty string alone', () => {
    expect(textPieces('')).toEqual([])
  })
})
