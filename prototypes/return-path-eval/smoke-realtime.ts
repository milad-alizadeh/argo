/** Throwaway: prove the realtime socket works and find the real event names before building on it. */
const key = process.env.OPENAI_API_KEY
if (!key) throw new Error('OPENAI_API_KEY unset')
const model = process.argv[2] ?? 'gpt-realtime-2.1'

const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, {
  headers: { Authorization: `Bearer ${key}` },
} as unknown as string[])

const seen: string[] = []
setTimeout(() => {
  console.log('\n--- event types seen ---')
  console.log(seen.join('\n'))
  process.exit(0)
}, 30_000)

ws.addEventListener('open', () => {
  console.log('open')
  ws.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions: 'Speak the payload you are given. Do not compress it.',
        output_modalities: ['audio'],
        audio: { output: { voice: 'alloy' } },
      },
    }),
  )
  ws.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '[REDUCED] result\n\n412 tests pass, 3 fail. I did not touch the STT adapter.' }],
      },
    }),
  )
  ws.send(JSON.stringify({ type: 'response.create' }))
})

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(String(ev.data)) as Record<string, unknown>
  const t = String(m.type)
  if (!seen.includes(t)) seen.push(t)
  if (t.includes('error')) console.log('ERROR:', JSON.stringify(m).slice(0, 600))
  if (t.includes('transcript.done') || t === 'response.done') {
    console.log(`\n[${t}]`, JSON.stringify(m).slice(0, 900))
  }
})
ws.addEventListener('error', (e) => console.log('socket error', e))
ws.addEventListener('close', (e) => console.log('closed', (e as CloseEvent).code, (e as CloseEvent).reason))
