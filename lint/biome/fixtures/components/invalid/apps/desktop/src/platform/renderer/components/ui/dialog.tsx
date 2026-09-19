import { Dialog } from 'radix-ui'

export async function loadAriaDialog() {
  return import('react-aria-components/dialog')
}

export { Dialog }
