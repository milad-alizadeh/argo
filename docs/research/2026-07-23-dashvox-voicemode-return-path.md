# DashVox & VoiceMode — the voice return path (agent output spoken back)

**Date:** 2026-07-23
**Question / ticket:** GitHub issue #191 (milad-alizadeh/argo) — wayfinder research. How do the only two shipping "coding-agent-that-talks-back" products handle the RETURN PATH, so we can design our voice concierge's return path deliberately.
**Snapshot:** early/mid-2026.

## Source-trust note

The two products sit at opposite ends of the evidence spectrum, and the writeup keeps them apart on purpose:

- **VoiceMode — verifiable.** Open source (MIT), `github.com/mbailey/voicemode`. Claims below marked **[source]** were read out of the actual tool code (`voice_mode/tools/converse.py`) or config docs — real mechanism, not marketing.
- **DashVox — marketing-only.** Closed source, no public docs/changelog/repo found. Everything is from the product site `dashvox.ai` and search snippets, marked **[marketing]**. Its predecessor project by the same author — **AgentWire** (Show HN, `news.ycombinator.com/item?id=46974968`) — *is* described in first-person technical detail and is a decent proxy for the DashVox internals; marked **[AgentWire/HN]**.

---

## Bottom line

Two fundamentally different return-path architectures:

- **VoiceMode = the coding agent speaks itself.** Voice is an **MCP tool (`converse`)** the LLM calls. There is no separate narrator: the model *chooses* when to talk by emitting a tool call, so speech is "pull-based at the LLM level" — proactive to the human, but gated by the agent's own turn logic, not by raw agent events. Screen (the Claude Code terminal) stays as ground truth; voice augments it.
- **DashVox = a go-between agent narrates on your behalf.** A separate interpreter agent SSHes into your machines, dispatches work to Claude Code / Codex, and **reads results back when a session reaches a checkpoint** (finishes or needs input) — summarized, not verbatim. Screen is "optional by design" because the target is car / watch / phone with no usable screen.

The single most transferable lesson: **decide who owns the decision to speak.** VoiceMode delegates it to the coding model (simple, but the model must be disciplined about brevity). DashVox inserts a dedicated summarizer/orchestrator between the raw agent stream and the ear (better for eyes-free, but it's an extra agent to build and trust).

---

## 1. When do they speak? (proactive vs pull, per-event vs turn-end)

**VoiceMode — agent-invoked, turn-shaped. [source]**
- Speech happens only when the LLM calls the `converse` tool. It is not wired to agent events (no "speak on every tool call / file write"). The model decides, so in practice it speaks at the end of a reasoning turn — the same cadence as a text reply.
- `converse` has two modes controlled by whether it expects a reply:
  - `ask` / `wait_for_response=true` → speak, then open the mic and block for the user (a real conversational turn).
  - `say` / `wait_for_response=false` → speak-and-continue narration, no listening (fire-and-forget status line).
- So "proactive vs pull" is really: **proactive to the human, but the trigger is the model's own turn-completion, not a firehose of events.** Getting good behavior depends on instructing the model to actually call `converse` each turn (the tool description carries that nudge; there is no separate event bus). This is a known soft spot — nothing forces the model to speak.

**DashVox — checkpoint narration by a separate agent. [marketing]**
- "A go-between agent interprets what you say, dispatches the work, and **reads results back when done**." The site frames it as "spoken session updates" and "approve steps," i.e. **checkpoint / turn-end**, not per-event narration. It "appears designed for checkpoint approvals rather than continuous narration."
- Message queuing + context compression let you "keep talking while sessions run" — so the return path is buffered/asynchronous: you can queue the next instruction while an agent is still working and hear updates as sessions hit their checkpoints. [marketing]

---

## 2. Reshaping dense output (summarize / truncate / progressive disclosure / barge-in)

**VoiceMode — read what the model produces; brevity is the model's job; real barge-in exists. [source]**
- No automatic summarization layer. Whatever text the model puts in the `say`/`ask` field is spoken. Density control is pushed onto the LLM (keep spoken turns short) rather than onto a post-processor.
- **Long/multi-part speech uses a producer/consumer pipeline** (`_speak_turns_pipeline`): it synthesizes turn N+1 while turn N is playing — buffered look-ahead, not single-utterance streaming. Smooths multi-sentence replies; does not shorten them.
- **Barge-in / interruption is first-class, over a control channel:**
  - a `stop` control during speech aborts and returns a result marked `"[control: stop]"` (`_build_control_stop_result`);
  - **skip-forward** ends the current playback early; **skip-back** replays. This is closer to a media transport than to true acoustic barge-in, but it does let the user cut off a long read.
- Pull-depth-on-demand isn't a built-in feature; it falls out of the conversation ("say more about X" → the model calls `converse` again).

**DashVox — summarizes before speaking. [marketing]**
- Output is explicitly "spoken **and summarized**" to "prevent overwhelming raw terminal dumps." So DashVox *does* put a reshaping step in the return path (the go-between agent), which is the opposite choice from VoiceMode. Mechanism/verbatim-vs-summary threshold is undocumented.
- CarPlay transport gives coarse manual control ("press to record, press to send, back to cancel") but no documented mid-speech barge-in.
- **[AgentWire/HN]** the author flags audio summarization of dense output as an *open problem* — the predecessor streamed agent responses as TTS and asked publicly whether push-to-talk vs continuous listening / wake-word is right. Treat DashVox's "summarized" claim as aspirational-recent, not battle-tested.

---

## 3. Approvals & steering by voice

**VoiceMode — approvals are just a conversational turn. [source]**
- There is no dedicated approval primitive. An approval is an `ask` turn: the model speaks the proposed action, `wait_for_response=true` opens the mic, the transcript comes back as the tool result, and the model acts on it. "yes / no / use the other approach" is free-form STT text handed straight back to the model — the model, not VoiceMode, interprets and confirms it. No structured read-back/confirm loop in the framework.

**DashVox — "approvals are verbal," confirmation loop undocumented. [marketing]**
- "Approvals are verbal — confirm actions by voice rather than screen taps." The site does **not** say whether it reads the proposed action back and requires an explicit "yes," or just forwards the utterance. This is a real gap for an eyes-free product and a place their docs are silent. Worth assuming they have *no* robust confirm-back yet.

---

## 4. Screen vs ear

**VoiceMode — screen is ground truth, voice augments. [source/context]**
- Runs *inside* Claude Code (a terminal). The full transcript, diffs, and tool output remain on screen; voice is an additional channel layered on a desk setup. It never has to cope with "no screen."

**DashVox — voice-first, screen optional by design. [marketing]**
- "The screen is optional by design" / "never required." Platform-tiered fallbacks:
  - **CarPlay / Android Auto:** glanceable press-to-record / press-to-send / back-to-cancel controls.
  - **Phone driving mode:** fully voice-driven, phone on the dashboard.
  - **Watch / glasses:** spoken replies delivered as notifications; Ray-Ban Meta "in exploration."
- Coping strategy for no-screen = summarize hard + verbal approvals + coarse physical controls. The safety caveat ("you are always responsible for driving safely") is the only stated boundary.

---

## 5. Stated failure modes / limitations

**VoiceMode [source + inferred from mechanism]:**
- **No forcing function to speak.** Because speech is an LLM tool call, a model that "forgets" to call `converse` silently drops back to text — the return path just goes quiet. This is the structural fragility of the tool-call approach.
- **No summarization** — verbose model output is spoken verbatim; brevity depends entirely on prompting.
- **VAD-timing sensitivity:** recording ends only after `SILENCE_THRESHOLD_MS` *and* `recording_duration >= max(MIN_RECORDING_DURATION, listen_duration_min)` (default min 2.0s, max 30s), tunable via `vad_aggressiveness` (0–3). Mis-tuned VAD either clips the user or waits too long — a classic push-past-silence failure.
- **Provider failover, not redundancy:** STT/TTS use "simple failover" over URL lists; a cloud fallback needs `OPENAI_API_KEY`.

**DashVox [marketing]:**
- **No public failure-mode / changelog / known-issues documentation found** — itself a finding. The only stated limit is the driving-safety disclaimer.
- **[AgentWire/HN]** the author's own listed limitations for the predecessor: "thin documentation," ongoing QoL work, and open uncertainty about the interaction model (push-to-talk vs wake-word). Reasonable to assume DashVox inherits these rough edges.

---

## 6. Architecture

**VoiceMode [source]:**
- **STT+TTS pipeline, not a full-duplex audio model.** Discrete stages: mic → STT → text to LLM → text from LLM → TTS → speaker.
- **MCP-based.** Ships as a Python MCP server exposing the `converse` tool; works with any MCP client (Claude Code, Cursor, VS Code/Copilot, Windsurf, Cline).
- **Local-first with cloud fallback:** STT = whisper.cpp (local) or OpenAI Whisper (cloud); TTS = Kokoro (local, multi-voice, can auto-start via `VOICE_MODE_AUTO_START_KOKORO`) or OpenAI TTS. Kokoro/local speak "the same API as OpenAI," so it swaps by base-URL.
- **Key env vars:** `VOICEMODE_TTS_BASE_URLS`, `VOICEMODE_STT_BASE_URLS`, `VOICEMODE_TTS_MODELS` (`tts-1`/`tts-1-hd`), `VOICEMODE_STT_MODEL`, `VOICEMODE_VOICES`, `VOICEMODE_TTS_VOICE`, `VOICEMODE_TTS_SPEED` (0.25–4.0), `VOICEMODE_VAD_AGGRESSIVENESS` (0–3), `OPENAI_API_KEY`.

**DashVox [marketing + AgentWire/HN]:**
- **SSH-to-your-machine, not MCP.** The app opens SSH sessions into your own machines where Claude Code / Codex already run; a go-between agent dispatches and narrates. Predecessor AgentWire used **tmux** as the session backbone with a browser/mobile portal + push-to-talk. [AgentWire/HN]
- **STT+TTS, bidirectional but not full-duplex** (not simultaneous listen+speak). [marketing]
- **Self-host (free, audio/data stays local) or DashVox Cloud** (managed VM; Firebase auth; SSH keys stored server-side with at-rest encryption "planned"). AgentWire was fully local — "no cloud, no accounts," Whisper STT, TTS on a GPU/WSL box or serverless (RunPod). [marketing + AgentWire/HN]

---

## `converse` tool parameters (VoiceMode) — verbatim [source]

From `voice_mode/tools/converse.py`:

| Param | Default | Role |
|---|---|---|
| `say` | (req. for speak turn) | text to speak, no reply expected |
| `ask` | (req. for listen turn) | speak then wait for a spoken reply |
| `wait_for_response` | `false` | back-compat alias; `{say:X, wait_for_response:true}` ≡ `{ask:X}` (setting both errors) |
| `voice` | — | per-turn voice override |
| `pause_after_ms` | call-level | gap after speaking |
| `tts_instructions` | — | style hint to TTS |
| `speed` | — | 0.25–4.0 |
| `listen_duration_max` | `30` s | target/max recording length |
| `listen_duration_min` | `2.0` s | min before silence can end recording |
| `vad_aggressiveness` | — | 0–3 silence-detection sensitivity |
| `ack` | `false` | acknowledgement toggle |

Recording ends on: silence past `SILENCE_THRESHOLD_MS` **and** `recording_duration >= max(MIN_RECORDING_DURATION, listen_duration_min)`, or `listen_duration_max`. During the initial wait "the only exit is speech detection or max_duration."

---

## Implications for our voice concierge (return path)

1. **Own the "when to speak" decision explicitly.** VoiceMode's leave-it-to-the-model design is the cheapest, but its failure mode (model goes silent) is real. A dedicated narration/summarization step (DashVox's go-between) is more work but is what makes eyes-free viable.
2. **Summarize in the return path, don't read verbatim.** DashVox reshapes; VoiceMode doesn't and relies on prompting. For a concierge with dense coding output, a real summarization stage is the differentiator.
3. **Build barge-in from day one.** VoiceMode's control-channel stop/skip is the good pattern — the user must be able to cut off a long read.
4. **Structured approval read-back is an open gap in both.** Neither has a robust "here's what I'll do, say yes" confirm loop; DashVox says "approvals are verbal" but documents no confirmation. This is a place we can beat both.
5. **Keep the screen as ground truth where one exists** (VoiceMode's stance); treat pure eyes-free (DashVox car/watch) as the harder tier that forces summarization + verbal confirm.
6. **STT+TTS pipeline is the shipped reality** for both — nobody here ships a full-duplex audio model. Local-first (whisper.cpp + Kokoro) with cloud fallback is proven.

---

## Sources

- VoiceMode repo (MIT, source of truth): https://github.com/mbailey/voicemode
- `converse` tool source: https://raw.githubusercontent.com/mbailey/voicemode/master/voice_mode/tools/converse.py
- VoiceMode README: https://raw.githubusercontent.com/mbailey/voicemode/master/README.md
- VoiceMode configuration guide: https://github.com/mbailey/voicemode/blob/master/docs/guides/configuration.md
- VoiceMode site (redirect target of voice-mode.readthedocs.io): https://voicemode.dev/
- DashVox product site: https://dashvox.ai/
- AgentWire Show HN (same author, predecessor, first-person technical detail): https://news.ycombinator.com/item?id=46974968
