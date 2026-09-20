// The terminal half of the #2111 repro: one process appending to a transcript, the way a Harness
// running outside Argo writes one. It must be its own process — an appender sharing the reader's
// event loop is starved by the very parse the repro measures, and the stall then never appears.
import { appendFileSync } from 'node:fs'

const [file, everyMs, from] = process.argv.slice(2)
if (file === undefined) throw new Error('usage: stalled-feed-writer <file> <everyMs> <fromIndex>')
let index = Number(from ?? '0')

setInterval(
  () => {
    index += 1
    appendFileSync(
      file,
      `${JSON.stringify({
        type: 'assistant',
        uuid: `external-live-${index}`,
        timestamp: new Date(Date.UTC(2026, 8, 13, 9, 0, 0) + index * 1000).toISOString(),
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: `Message ${index}. ${'prose '.repeat(40)}` }],
        },
      })}\n`,
    )
  },
  Number(everyMs ?? '10'),
)
