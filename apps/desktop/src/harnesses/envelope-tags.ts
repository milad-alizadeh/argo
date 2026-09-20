// Both HARNESSES wrap harness text in XML-like envelopes, and a field is one tag's contents.
export function taggedText(body: string, tag: string): string | null {
  return new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(body)?.[1] ?? null
}

// The same contents read as a field: trimmed, and null when nothing is left.
export function taggedField(body: string, tag: string): string | null {
  return taggedText(body, tag)?.trim() || null
}
