// Codex realtime voice's `<realtime_conversation>` developer instructions make every assistant
// item open with `[STATUS] ` or `[COMPLETE] `, or `::codex-realtime-inline{}` for inline Markdown.
// The tag routes the item to the voice frontend and says nothing to a reader.
const CHANNEL_TAG = /^\s*(?:\[(?:STATUS|COMPLETE)\] ?|::codex-realtime-inline\{\}\s*)/

export function withoutChannelTag(text: string): string {
  return text.replace(CHANNEL_TAG, '')
}
