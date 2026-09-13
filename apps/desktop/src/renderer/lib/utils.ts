import { createCn } from 'cn/config'

const TEXT_SIZES = [
  'badge',
  'body',
  'chip',
  'code',
  'control',
  'eyebrow',
  'heading',
  'label',
  'meta',
  'prose',
  'session-body',
  'session-code',
  'session-heading',
  'session-meta',
  'session-title',
  'tally',
  'title',
] as const

export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: [...TEXT_SIZES] }] } },
})
