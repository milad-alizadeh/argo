/**
 * A generic (system, user) -> text call. Deliberately NOT `../marker-drop-rate/models.ts`'s
 * `reshape`, which is welded to the reshaper contract's prompt and cap; this rig needs the same
 * transports carrying three different prompts (router, judge, and the control's reshaper).
 *
 * The `claude` CLI recipe — stripped flags, spawned from a directory with no CLAUDE.md so the
 * repo's own instructions stay out of the prompt — is #193's, copied rather than imported for
 * the same reason. Its timing caveat carries over: `ms` includes the agent-loop tax and a
 * fresh process per call, so it is comparable between CLI models and to nothing else.
 */

export type Backend =
  | { readonly kind: 'claude-cli'; readonly model: string; readonly label: string }
  | { readonly kind: 'openai'; readonly model: string; readonly label: string }
  | { readonly kind: 'lmstudio'; readonly key: string; readonly label: string }

/** Vendor, for the mixed-panel logic in `council.ts`. Two judges from one vendor are one lens. */
export const vendorOf = (b: Backend): string =>
  b.kind === 'claude-cli' ? 'anthropic' : b.kind === 'openai' ? 'openai' : 'local'

export type Completion = {
  readonly text: string
  readonly ms: number
  readonly error?: string
}

const LMSTUDIO = 'http://localhost:1234/v1/chat/completions'

async function viaClaudeCli(b: Backend & { kind: 'claude-cli' }, system: string, user: string) {
  const proc = Bun.spawn(
    [
      'claude',
      '-p',
      '--model',
      b.model,
      '--strict-mcp-config',
      '--disable-slash-commands',
      '--setting-sources',
      'project',
      '--exclude-dynamic-system-prompt-sections',
      '--append-system-prompt',
      system,
      user,
    ],
    { cwd: '/tmp', stdout: 'pipe', stderr: 'pipe' },
  )
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) throw new Error(err.slice(0, 300) || `claude exited ${code}`)
  return out.trim()
}

async function viaLmStudio(b: Backend & { kind: 'lmstudio' }, system: string, user: string) {
  const list = (await (await fetch('http://localhost:1234/v1/models')).json()) as {
    data?: { id: string }[]
  }
  const id = (list.data ?? []).map((m) => m.id).find((m) => m.includes(b.key))
  if (!id) throw new Error(`no LM Studio model matching "${b.key}"`)
  const res = await fetch(LMSTUDIO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: id,
      temperature: 0,
      max_tokens: 2000,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  // Strip any thinking block that leaked past the template kwarg (see models.ts — LM Studio
  // does not reliably forward it).
  return (json.choices?.[0]?.message?.content ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
}

async function viaOpenAI(b: Backend & { kind: 'openai' }, system: string, user: string) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY unset')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: b.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return (json.choices?.[0]?.message?.content ?? '').trim()
}

const CALL: Record<Backend['kind'], (b: never, s: string, u: string) => Promise<string>> = {
  'claude-cli': viaClaudeCli as never,
  openai: viaOpenAI as never,
  lmstudio: viaLmStudio as never,
}

export async function complete(b: Backend, system: string, user: string): Promise<Completion> {
  const t0 = performance.now()
  try {
    const text = await CALL[b.kind](b as never, system, user)
    return { text, ms: performance.now() - t0 }
  } catch (e) {
    return { text: '', ms: performance.now() - t0, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Bounded fan-out. The council alone is 7 judge calls per trial and the sweep multiplies that
 * by arms and corpus; unbounded Promise.all spawns hundreds of `claude` processes and the
 * machine falls over long before the rate limit does.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      const item = items[i]
      if (item === undefined) return
      out[i] = await fn(item, i)
    }
  })
  await Promise.all(workers)
  return out
}
