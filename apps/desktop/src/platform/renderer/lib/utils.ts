import { createCn } from 'cn/config'

import { TYPOGRAPHY_RECIPES } from './text-sizes'

export const cn = createCn({
  extend: {
    classGroups: { typography: [{ type: [...TYPOGRAPHY_RECIPES] }] },
    conflictingClassGroups: {
      typography: ['font-size', 'leading', 'font-weight', 'tracking'],
    },
  },
})
