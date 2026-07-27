/**
 * Stage 3 — the model that actually speaks, behind an interface.
 *
 * #221's finding is the reason this stage exists at all: on the public Realtime API the audio
 * model ALWAYS re-generates the line and is instructed to; no verbatim mode is reachable
 * (`speakable` only ever serialises onto the alpha `/v1/live` surface, and OpenAI's own README
 * says the mode selector "has no effect on V1 or V2"). So the only lever is
 * `session.instructions` — and whether that lever works is #222 §3's load-bearing bet.
 *
 * PORTABILITY: the interface is the point. Verified while scoping this ticket — OpenRouter
 * cannot host this leg at all (two discrete endpoints, `/audio/speech` and
 * `/audio/transcriptions`, no session), and the Vercel AI SDK's realtime support is beta in
 * SDK 7 behind AI Gateway with bring-your-own-key, so it swaps the wire and not the contract.
 * Either becomes one `Speaker` implementation; neither is load-bearing.
 *
 * VERIFIED against the live API (`gpt-realtime-2.1`, see `smoke-realtime.ts`): the session
 * shape below is the one that actually connects, and `response.output_audio_transcript.done`
 * carries the model's own transcript of what it said — the string the council scores. The
 * `response.done` envelope also carries `phase: "final_answer"`, i.e. #210's phase field is
 * present on the PUBLIC API and not only on the alpha surface #221 read.
 *
 * It is wired so that a missing key produces a skipped trial, never a fabricated transcript.
 * Nothing in this file may invent a spoken line.
 */

export type Speaker = {
  readonly label: string
  /** Resolves to the transcript of what the model said, or throws. Never returns a guess. */
  speak(payload: string, instructions: string): Promise<{ transcript: string; ms: number }>
}

/**
 * #222 §3, ordered as the resolution ordered them. Clause 1 is the bet: it is the OPPOSITE of
 * the incumbent's prompt ("the key takeaway without repeating visible content"), which is
 * right for a 1,000-token wall and wrong for a tight core.
 *
 * `withPreReducedClause: false` is the control half of the A/B. #203 finding 4 showed a prompt
 * clause can silently fail to take, so shipping this one unmeasured would repeat the mistake
 * #222 itself called out.
 */
export const sessionInstructions = (withPreReducedClause: boolean): string => {
  const clauses = [
    withPreReducedClause
      ? 'The payload you are given is ALREADY REDUCED. Speak it. Do not compress it further, do not summarise it, do not pick out only the highlights. Length is not a problem; leaving something out is.'
      : null,
    'Carry these through as the exact words they are: negations (not, no, never, cannot), scope restrictors (only, just, except, all), conditionals (if, unless, until), and hedges (might, may, likely, seems).',
    'If anything is uncertain, say so out loud. Never hide uncertainty behind a confident sentence.',
    'The user has the full text on screen. You are the eyes-free channel over it.',
  ].filter(Boolean)
  return clauses.join('\n\n')
}

/** Used when no key is configured, so a run reports "stage 3 skipped" instead of inventing one. */
export const absentSpeaker = (reason: string): Speaker => ({
  label: `absent (${reason})`,
  speak: () => Promise.reject(new Error(`stage 3 unavailable: ${reason}`)),
})

const REALTIME_URL = 'wss://api.openai.com/v1/realtime'

/**
 * One session per call — wasteful, and correct for a measurement: a shared session would carry
 * conversation history between trials, so trial N's payload would sit in trial N+1's context
 * and the model could condense with reference to it. Independence beats throughput here.
 */
/**
 * Audio generation runs at roughly 10 spoken words per second (measured: 52 words in 6.5s), so
 * the timeout has to scale with the payload or the long tail of arm B fails by construction —
 * which is exactly what a 60s constant did on the first run, erroring 8 trials, four of them
 * the control arm. A timeout that correlates with arm would have silently biased the
 * comparison.
 */
const timeoutFor = (payload: string): number =>
  Math.min(300_000, 60_000 + 150 * payload.split(/\s+/).filter(Boolean).length)

export const realtimeSpeaker = (apiKey: string, model = 'gpt-realtime'): Speaker => ({
  label: `realtime:${model}`,
  speak: (payload, instructions) =>
    new Promise((resolve, reject) => {
      const t0 = performance.now()
      const ws = new WebSocket(`${REALTIME_URL}?model=${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      } as unknown as string[])
      const budget = timeoutFor(payload)
      const timer = setTimeout(() => {
        ws.close()
        reject(new Error(`realtime timeout after ${Math.round(budget / 1000)}s`))
      }, budget)
      const finish = (fn: () => void) => {
        clearTimeout(timer)
        ws.close()
        fn()
      }

      ws.addEventListener('open', () => {
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              instructions,
              // Audio out, not text — the whole question is what the model SAYS, and #221's
              // finding is a property of the speaking path. A text-only session would be
              // cheaper and would measure a different thing.
              output_modalities: ['audio'],
              audio: { output: { voice: 'alloy' } },
            },
          }),
        )
        // The `[REDUCED]` user-role item — #221's observed `[BACKEND] ` convention.
        ws.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: payload }] },
          }),
        )
        ws.send(JSON.stringify({ type: 'response.create' }))
      })

      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(String(ev.data)) as { type?: string; transcript?: string; error?: { message?: string } }
        // The model's own transcript of what it spoke — the thing the council scores.
        if (msg.type === 'response.output_audio_transcript.done' && msg.transcript) {
          finish(() => resolve({ transcript: msg.transcript ?? '', ms: performance.now() - t0 }))
        }
        if (msg.type === 'error') finish(() => reject(new Error(msg.error?.message ?? 'realtime error')))
      })
      ws.addEventListener('error', () => finish(() => reject(new Error('realtime socket error'))))
    }),
})

export const speakerFromEnv = (): Speaker => {
  const key = process.env.OPENAI_API_KEY
  return key
    ? realtimeSpeaker(key, process.env.REALTIME_MODEL ?? 'gpt-realtime-2.1')
    : absentSpeaker('OPENAI_API_KEY unset')
}
