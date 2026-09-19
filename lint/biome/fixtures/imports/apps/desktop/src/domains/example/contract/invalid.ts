import { readFile } from 'node:fs/promises'
import React from 'react'
import { mainValue } from '@/domains/example/main/store'
import { writeDocument } from '@/platform/main/storage/portable-file'
import { sibling } from './nested/sibling'
import { parent } from '../renderer/view'

export { mainValue, parent, React, readFile, sibling, writeDocument }
