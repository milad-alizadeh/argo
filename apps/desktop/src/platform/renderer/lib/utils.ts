import { createCn } from 'cn/config'

import { TEXT_SIZES } from './text-sizes'

export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: [...TEXT_SIZES] }] } },
})
