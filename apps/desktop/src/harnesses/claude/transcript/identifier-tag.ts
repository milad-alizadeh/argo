import { taggedField } from '@/harnesses/host/envelope-tags'
import { isIdentifier } from '@/shared/validation'

export function identifierTag(text: string, tag: string): string | null {
  const value = taggedField(text, tag)
  return value !== null && isIdentifier(value) ? value : null
}
