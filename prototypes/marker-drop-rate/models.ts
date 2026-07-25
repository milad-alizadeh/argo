/**
 * Reshaper backends.
 *
 * Two transports, because #203's model axis spans both: LM Studio's OpenAI-compatible server
 * for the local candidates, and the subscription `claude` CLI for Haiku (no API key on this
 * machine, and #193 established the warm-CLI recipe).
 *
 * THINKING IS FORCED OFF on both local models. This is not only #193's latency finding — the
 * constraint-level error-shift result (arXiv 2606.09662) is that built-in thinking *degrades*
 * required-keyword, negation and conditional constraints, which is precisely the class #199's
 * guard protects. Verbose intermediate steps make terminal constraints harder to apply. So
 * non-thinking is the faithful setting, not merely the fast one.
 */

import { systemPrompt, userPrompt, type Cap } from "./contract";

export type ModelId = "haiku" | "qwen3.5-4b" | "gemma4-e4b" | "qwen3.5-9b";

export type ModelSpec = {
  readonly id: ModelId;
  readonly label: string;
  readonly transport: "lmstudio" | "claude-cli";
  /** LM Studio model key; unused for the CLI. */
  readonly key?: string;
  /** The card's recommended sampling temperature — the non-zero arm of the temp dial. */
  readonly recommendedTemp?: number;
};

export const MODELS: Record<ModelId, ModelSpec> = {
  haiku: {
    id: "haiku",
    label: "Haiku 4.5 (subscription CLI)",
    transport: "claude-cli",
  },
  "qwen3.5-4b": {
    id: "qwen3.5-4b",
    label: "Qwen3.5-4B (MLX 4bit)",
    transport: "lmstudio",
    key: "qwen3.5-4b",
    recommendedTemp: 0.7,
  },
  "gemma4-e4b": {
    id: "gemma4-e4b",
    label: "Gemma 4 E4B (MLX 4bit)",
    transport: "lmstudio",
    key: "gemma-4-e4b-it",
    recommendedTemp: 1.0,
  },
  "qwen3.5-9b": {
    id: "qwen3.5-9b",
    label: "Qwen3.5-9B (MLX 4bit)",
    transport: "lmstudio",
    key: "qwen3.5-9b",
    recommendedTemp: 0.7,
  },
};

const LMSTUDIO = "http://localhost:1234/v1/chat/completions";

/** Models emit thinking in several wrappers; strip them all so the check sees the spoken line. */
const stripThinking = (raw: string): { line: string; thought: boolean } => {
  const before = raw;
  const line = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|?think\|?>[\s\S]*?<\|?\/?think\|?>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .trim();
  return { line, thought: line !== before.trim() };
};

/** The model sometimes wraps the line in quotes or a "Spoken line:" label despite the prompt. */
const unwrap = (s: string): string =>
  s
    .replace(/^(?:spoken line|line|output)\s*:\s*/i, "")
    .replace(/^["'“”]|["'“”]$/g, "")
    .replace(/\s+/g, " ")
    .trim();

export type Reshaped = {
  readonly line: string;
  readonly ms: number;
  readonly thoughtLeaked: boolean;
  readonly error?: string;
};

async function viaLmStudio(
  spec: ModelSpec,
  cap: Cap,
  source: string,
  temperature: number,
  extraTurns: readonly { role: "assistant" | "user"; content: string }[] = [],
): Promise<Reshaped> {
  const t0 = performance.now();
  try {
    const res = await fetch(LMSTUDIO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: spec.key,
        temperature,
        max_tokens: 400,
        stream: false,
        // Hybrid-thinking off. LM Studio forwards chat_template_kwargs to the template;
        // `reasoning` is honoured by newer builds. Send both — harmless if one is ignored.
        chat_template_kwargs: { enable_thinking: false, thinking: false },
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: systemPrompt(cap) },
          { role: "user", content: userPrompt(source) },
          ...extraTurns,
        ],
      }),
    });
    const ms = performance.now() - t0;
    if (!res.ok) {
      return { line: "", ms, thoughtLeaked: false, error: `HTTP ${res.status}: ${await res.text()}` };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const hadReasoningField = Boolean(json.choices?.[0]?.message?.reasoning_content);
    const { line, thought } = stripThinking(raw);
    return { line: unwrap(line), ms, thoughtLeaked: thought || hadReasoningField };
  } catch (e) {
    return {
      line: "",
      ms: performance.now() - t0,
      thoughtLeaked: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Subscription Haiku via the CLI, stripped per #193's recipe. Run from a directory with no
 * CLAUDE.md so the repo's own instructions don't enter the prompt. No temperature flag exists,
 * so Haiku has only one temp arm — a real gap in the temp dial, reported rather than papered over.
 */
async function viaClaudeCli(
  cap: Cap,
  source: string,
  extraTurns: readonly { role: "assistant" | "user"; content: string }[] = [],
): Promise<Reshaped> {
  const t0 = performance.now();
  const prompt =
    extraTurns.length === 0
      ? userPrompt(source)
      : `${userPrompt(source)}\n\nYour previous attempt: ${extraTurns[0]?.content}\n\n${extraTurns[1]?.content}`;
  try {
    const proc = Bun.spawn(
      [
        "claude",
        "-p",
        "--model",
        "claude-haiku-4-5",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--setting-sources",
        "project",
        "--exclude-dynamic-system-prompt-sections",
        "--append-system-prompt",
        systemPrompt(cap),
        prompt,
      ],
      { cwd: "/tmp", stdout: "pipe", stderr: "pipe" },
    );
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const ms = performance.now() - t0;
    if (code !== 0) return { line: "", ms, thoughtLeaked: false, error: err.slice(0, 300) };
    return { line: unwrap(out), ms, thoughtLeaked: false };
  } catch (e) {
    return {
      line: "",
      ms: performance.now() - t0,
      thoughtLeaked: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const reshape = (
  spec: ModelSpec,
  cap: Cap,
  source: string,
  temperature: number,
  extraTurns?: readonly { role: "assistant" | "user"; content: string }[],
): Promise<Reshaped> =>
  spec.transport === "lmstudio"
    ? viaLmStudio(spec, cap, source, temperature, extraTurns)
    : viaClaudeCli(cap, source, extraTurns);

/** Which LM Studio model keys are actually loadable right now. */
export async function availableLocalKeys(): Promise<string[]> {
  try {
    const res = await fetch("http://localhost:1234/v1/models");
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => m.id);
  } catch {
    return [];
  }
}
