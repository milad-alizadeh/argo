# ChatGPT's in-session voice and its routing seam — the shipped analogue of ADR-0007

**Date:** 2026-07-25 · **For:** wayfinder [#210](https://github.com/milad-alizadeh/argo/issues/210), part of map [#190](https://github.com/milad-alizadeh/argo/issues/190) · **Status:** desk research, primary sources

**Question.** ChatGPT's voice mode now lives *inside* the chat session and visibly routes turns to a slower
reasoning model. That is the closest shipping analogue to what this map is designing, and the one that most
directly tests [ADR-0007](../adr/0007-voice-concierge-delegated-reasoning.md)'s central bet — adopted with the
explicit caveat that *"the delegated split is an engineering choice, not a benchmarked pattern."*
[#191](https://github.com/milad-alizadeh/argo/issues/191) covered the two coding-agent players; neither runs
full-duplex, neither routes to a reasoner. This is the missing third data point.

**Method.** Primary sources only for load-bearing claims: OpenAI product announcements, the GPT-Live system
card, ChatGPT release notes and Help Center, the Realtime API guides and prompting guide, the API changelog,
the Agents SDK docs *and source*, OpenAI's own reference voice-agent repo, Google's Gemini Live API docs and
launch post, Anthropic's voice-mode help article and launch post. Secondary sources (HN, the OpenAI forum) are
used **only** for dating a rollout or for what users report — never for a mechanism. Where a mechanism is not
publicly documented this file says so rather than inferring, and inferences read from source code are labelled
as such.

---

## Bottom line

**ADR-0007's split stopped being an unbenchmarked engineering choice on 2026-07-08.** OpenAI rebuilt ChatGPT
Voice around precisely it: a **full-duplex audio model that keeps the conversation and delegates the hard part
to a frontier text model in the background**, then brings the answer back into the live conversation. It is
their flagship consumer voice experience, it has a system card, and it has a named, documented developer
pattern behind it. Argo's architecture is no longer speculative.

But the finding that actually matters is sharper than "we were right":

1. **Delegation and in-backbone reasoning both won — they are tiers, not rivals.** The same vendor ships both.
   The *product* delegates to GPT-5.5; the *API* model `gpt-realtime-2.1` is itself described as a "realtime
   reasoning model" with `reasoning.effort` from `minimal` to `xhigh`. Delegation is reserved for search,
   agentic work, and frontier intelligence — not for thinking in general. ADR-0007 frames this as either/or;
   the shipping answer is *both, tiered by cost of being wrong*.
2. **Nobody ships the monologue-intercept hook.** Every documented seam is a **tool call** — structured
   arguments plus an explicit conversation-history snapshot — not a tap on the audio model's inner monologue.
   ADR-0007's specific mechanism is the one part with no shipping precedent.
3. **The wait is designed, mandatory, and short.** OpenAI's reference implementation *requires* an
   outcome-neutral filler utterance before every delegation, and measures ~2 s of covered latency. `gpt-realtime-2`
   generates these "preambles" by default, and the API labels them as a distinct response `phase`.
4. **In OpenAI's reference, the reasoner writes the spoken line and the audio model reads it verbatim.** The
   brevity-vs-fidelity contract lives in the *supervisor's* prompt, not in a separate reshaping step. Argo's
   locked framing puts reshaping in the concierge. This is a real, actionable divergence for #192/#207.
5. **Anthropic went the other way, three weeks later.** On 2026-07-23 Claude voice mode moved *off* a fast
   small model and onto Opus/Sonnet themselves — no separate audio model, no delegation, turn-based latency
   accepted — explicitly because Haiku-only "kept conversations quick, but not always deep." Two shipping
   vendors resolved the same fast-vs-deep tension in opposite directions. The pattern is validated; it is not
   the only answer.

---

## Which findings support, complicate, or contradict ADR-0007's delegated split

ADR-0007's own risk #1: *"The delegated split is an engineering choice, not a benchmarked pattern — no surveyed
source benchmarks 'audio model + separate cloud reasoner.' The research frontier is the opposite."* That is the
sentence this pass exists to test.

### Supports

- **The pattern shipped, at flagship scale.** "For questions that require web search, deeper reasoning, or more
  complex work, it delegates to our latest frontier model behind the scenes and brings the result back into the
  conversation when it's ready. While it works, GPT‑Live can keep talking with you and maintain the flow of
  conversation." OpenAI names it as one of two architectural changes: *"we decoupled GPT‑Live — which handles
  continuous interaction — from deeper work."*
  ([Introducing GPT‑Live](https://openai.com/index/introducing-gpt-live/), 2026-07-08.)
- **The read-only-concierge / acting-router division is mirrored, and for the same reason.** The system card
  states the audio models *"lack broad access to tools independently of the models to which they delegate, and
  do not have code execution capability"*, and that delegated work *"will reflect the safety training of the
  underlying model that is doing that work."*
  ([GPT-Live System Card](https://deploymentsafety.openai.com/gpt-live), 2026-07-08.) ADR-0007's "the concierge
  stays read-only; the router performs all actions" is the same containment argument, arrived at independently.
- **It is a documented developer pattern, not just a product.** The JS Agents SDK has a section titled
  *Delegation through tools* with an architecture diagram, and states outright: *"if you need to use a different
  model, for example a reasoning model like `gpt-5.4`, or delegate to a non-realtime backend agent, use
  delegation through tools."*
  ([Agents SDK JS — voice agents](https://openai.github.io/openai-agents-js/guides/voice-agents/build/).)
  OpenAI's own reference repo names the pattern **Chat-Supervisor** and ships it as the default demo.
  ([openai-realtime-agents](https://github.com/openai/openai-realtime-agents).)
- **The wait is coverable, with a number.** OpenAI's Chat-Supervisor README annotates its own screenshot:
  *"There ~2s between the end of 'give me a moment to check on that.' being spoken aloud and the start of
  'Thanks for waiting. Your last bill...'."* It also claims the delegated architecture beats the cascaded one on
  felt latency: *"the model responds to the user right away, even if it has to lean on the supervisor agent"*
  versus a stitched pipeline *"where response latency is often 1.5s or longer after a user has finished
  speaking."* ADR-0007 open question #2 (delegated round-trip latency) now has a published reference point.
- **#192's fidelity contract is, near enough, OpenAI's supervisor prompt.** The supervisor is instructed:
  *"The message is for a voice conversation, so be very concise, use prose, and never create bulleted lists.
  Prioritize brevity and clarity over completeness. Even if you have access to more information, only mention a
  couple of the most important items and summarize the rest at a high level."* Independent convergence on
  "condense, never contradict; lead with the kernel; depth is pullable."
- **Voice-as-interaction-layer over an execution-layer is now shipping for coding agents.** ChatGPT Voice in
  Work and Codex (2026-07-23): *"ChatGPT Voice can start separate threads for longer tasks, check existing
  threads, and send follow-up instructions. It brings progress, blockers, and results back to your voice
  conversation so you can keep talking while work continues."*
  ([ChatGPT Voice — Codex docs](https://learn.chatgpt.com/docs/features/voice).) That is #194's posture C —
  speak up on progress, blockers, and completion — shipped by the incumbent, five days ago. It also validates
  #190's "One voice": *"Only one voice chat can be active across the ChatGPT desktop app at a time."*

### Complicates

- **The frontier trend ADR-0007 feared also won — in the same product family.** `gpt-realtime-2.1` is described
  in the changelog as *"an updated realtime **reasoning** model"*
  ([API changelog](https://platform.openai.com/docs/changelog), 2026-07-06), and the prompting guide tells you to
  *"prompt Realtime 2 as a reasoning voice agent, not as a basic voice bot"*, exposing `reasoning.effort` at
  `minimal | low | medium | high | xhigh`. Gemini Live does the same with `thinkingLevel`. So "fold reasoning into
  the audio backbone" is not a research frontier any more; it is the default API posture, and *delegation sits on
  top of it* for frontier-grade work. **Consequence for Argo:** the router is not the only place reasoning can
  live, and a spec that assumes "audio model = dumb front end" will mis-size the seam. ADR-0007's swappability
  clause is doing real work here.
- **Where the voice-shaping happens is contested, and OpenAI put it on the other side of the seam.** #190's
  locked framing says reshaping happens *in the concierge*. In Chat-Supervisor the **supervisor writes the
  user-facing sentence** and the realtime agent is told the supervisor *"provides a high-quality answer, which
  you should read verbatim"*; the supervisor prompt says *"Your message will be read verbatim by the junior
  agent."* If the reasoner authors the spoken line, then #199's marker guard and #203's dials belong on the
  **router's** output, not on a distinct downstream reshaper — and #207's "speaks extractively on ~1 line in 8"
  problem changes shape. This is the single most actionable divergence in this pass.
- **"Who owns *when* to speak" (#194's open decision) has been formalised into API surface by Google, not by
  OpenAI.** Gemini's Live API lets a delegated call be declared `behavior: NON_BLOCKING`, and its result carries
  an explicit `scheduling` value: `INTERRUPT` (say it now), `WHEN_IDLE` (say it when the current utterance
  finishes), or `SILENT` (absorb it, don't speak).
  ([Gemini Live tools](https://ai.google.dev/gemini-api/docs/live-tools).) OpenAI's JS SDK has a two-state
  version — `backgroundResult(output)` returns tool output *"without immediately triggering another model
  response."* Argo's spec should adopt a three-way scheduling vocabulary rather than a speak/don't-speak boolean;
  `WHEN_IDLE` in particular is exactly what posture C needs and what a boolean cannot express.
- **The two OpenAI SDKs disagree about whether the wait is actually free.** The Python SDK defaults
  `async_tool_calls: True` and its source comments the dispatcher *"Run tool calls in the background to avoid
  blocking realtime transport."* The JS guide says the opposite for its path: *"While the tool is executing the
  agent will not be able to process new requests from the user. One way to improve the experience is by telling
  your agent to announce when it is about to execute a tool or say specific phrases to buy the agent some time."*
  So "keep talking during delegation" is a property of the *harness*, not of delegation itself. Argo must build
  it deliberately; it will not fall out of the architecture.
- **The delegated split has a documented felt failure mode, and it is exactly Argo's risk.** A user report on
  the in-session voice: *"The current Voice/Live experience feels like a separate layer inserted into the
  conversation... The interface makes it look like the same assistant is continuing the same conversation, but
  the behavior suggests that Voice may have different effective context handling, reasoning depth, tool access,
  or instruction-following."* ([OpenAI forum, 2026-05-17](https://community.openai.com/t/i-want-to-add-serious-feedback-about-the-current-chatgpt-voice-live-experience/1381176).)
  Argo's concierge relays for a session it is not; the same seam is available to leak the same way.
- **Anthropic's counter-example.** Claude voice mode, 2026-07-23: *"until now, voice mode only ran on our Claude
  Haiku model, which we chose for speed. It kept conversations quick, but not always deep."* The fix was to put
  Opus and Sonnet *in* voice mode — *"Voice mode uses the fastest version of whichever model you've selected"* —
  and to keep it turn-based: *"Claude listens, pauses to think, and then responds."*
  ([Think through hard problems in voice mode](https://claude.com/blog/think-through-hard-problems-in-voice-mode).)
  No audio model, no delegation, no filler layer. This is the strongest available evidence that the split is a
  *choice* rather than a necessity — which is what ADR-0007 said, and remains true.

### Contradicts

Nothing in this pass contradicts the delegated split as an architecture. Two things contradict ADR-0007's
*specific mechanism*, both in spike territory and flagged rather than recommended:

- **The monologue-intercept hook has no shipping precedent.** ADR-0007 forwards "the aligned inner-monologue text
  stream" to the router. Every seam documented here is instead a **function tool**: the audio model *decides* to
  delegate, emits structured arguments, and the harness attaches an explicit history snapshot. Nothing observed
  taps a continuous text stream. Not proof the hook is wrong — Moshi's monologue is a different affordance from
  anything OpenAI exposes — but the "everyone does it this way" support Argo might have hoped for is absent.
- **OpenAI's answer to ADR-0007 open question #4 is neither of ADR-0007's two options.** ADR-0007 asks how to
  capture the *user's* intent when the hook only exposes the audio model's own speech, and offers "parallel STT
  or paraphrase-back." OpenAI's cookbook rejects the parallel-STT arm explicitly — *"The Realtime API offers
  built-in user input transcription, but this relies on a separate ASR model... Using different models for
  transcription and response generation can lead to discrepancies"* — and recommends **out-of-band
  transcription**: a second `response.create` on the same socket with `conversation: "none"`, running the *same
  audio model* with a transcription prompt so it never writes back to conversation state.
  ([Realtime out-of-band transcription](https://cookbook.openai.com/examples/realtime_out_of_band_transcription).)
  Priced at 3–5× a dedicated ASR for the latest turn, 16–20× with full session context. **Flagged to ADR-0007 /
  [#196](https://github.com/milad-alizadeh/argo/issues/196); not a recommendation here** — whether Moshi or
  PersonaPlex can be driven out-of-band at all is a spike question.

**Verdict.** ADR-0007's risk #1 can be downgraded from "unbenchmarked pattern" to "shipping pattern with a
published latency reference and two named reference implementations." The consequence to *raise* in its place is
the tiering question: reasoning now lives on both sides of the seam, and the spec needs to say which work
crosses it.

---

## Findings

### 1. Voice in the session

**What changed, and when.** Two distinct events, eight months apart, and the ticket's framing usefully
conflates them:

- **2025-11-25 — voice moves into the chat interface.** *"We're making ChatGPT Voice a seamless part of the ChatGPT experience, so
  you can use voice right inside the chat interface you already use every day — no separate mode required."*
  Answers appear *"spoken alongside streamed text, image search results, widgets (maps, weather, etc.) and more
  — right in the same chat thread."* The stated user-facing rationale is verbatim: *"Many of you have asked for a
  more flexible Voice experience — now, you can speak, listen, and see your conversation at the same time"*, and
  the listed capabilities are follow-along typed answers, live visual search results, referring back to earlier
  messages, typing back when you can't talk, and sharing photos to discuss aloud. A "Separate mode" toggle was
  kept for people who preferred the old full-screen experience.
  ([ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).)
- **2026-07-08 — the engine behind that interface changes.** GPT-Live-1 / GPT-Live-1 mini replace Advanced Voice Mode.
  *"GPT-Live-1 works inside a ChatGPT chat, with spoken responses appearing alongside streamed text."*

**What is on screen while you speak.** ChatGPT's responses *"appear as text in the chat while they are spoken"*
(this is Live-specific; Advanced needed a `cc` button). Rich visual cards render live for *"weather, stocks,
sports, and more"*, plus image search results and map cards. A transcript is appended to the chat when the
conversation ends, with the explicit caveat that *"Voice transcripts are not verbatim records and may not exactly
match what was said."*
([ChatGPT Voice Help Center](https://help.openai.com/articles/20001274).)

**One thread, and mid-conversation modality switching.** Yes, in consumer ChatGPT: *"Live can accept text and
images in the same chat as your Voice conversation. While Voice is active, use the add button in the message bar
to attach an available image, or type a message instead of speaking. ChatGPT can respond in Voice without
starting a separate chat."* Audio clips are stored *with* the transcript in chat history and retained 30 days.
Two asymmetries worth noting: changing voice mid-call *"starts a new voice call in the same chat"*, and in the
**desktop Work/Codex** surface the switch is one-way — *"A chat or task must begin in voice mode to use ChatGPT
Voice. Chats or tasks that start in another mode offer voice dictation instead."*

**Stated rationale, at the architecture level.** OpenAI's own history: cascaded STT→LLM→TTS meant *"information
could be lost across models, and responses were slow and stilted"*; turn-based speech-to-speech (AVM) fixed
latency but *"still operated through discrete turns... because turn detection is based on silence, even a brief
pause or background noise could be mistaken for the end of turn."* GPT-Live's fix is continuous processing —
*"the model can therefore make interaction decisions many times per second: whether to speak, continue listening,
pause, interrupt, or invoke a tool."* Note that *invoke a tool* is listed as a per-moment interaction decision,
alongside speaking.

### 2. The routing seam

**In ChatGPT: delegation, and the mechanism is not published.** The product-level description is consistent
across the announcement, the system card, and the release notes: GPT-Live handles interaction, delegates search /
deeper reasoning / agentic work to GPT-5.5 in the background, and brings the result back. The user can bias the
decision with a **Settings → Voice → Intelligence** tier of `Instant | Medium | High`, with the honest warning
that *"Higher intelligence levels may take longer to respond, especially when Voice searches the web."*

What is **not** documented: what crosses the seam, who exactly decides, or the wire format. OpenAI's only
published engineering deep-dive on realtime infrastructure is about WebRTC termination and routing and says
nothing about delegation
([How OpenAI delivers low-latency voice AI at scale](https://openai.com/index/delivering-low-latency-voice-ai-at-scale/)).
The one first-party statement on topology is an OpenAI engineer answering on Hacker News: delegation could be to
one agent, to multiple tracked agents, or to an orchestrator that fans out, *"but... Our current implementation is
backed by one model."*
([HN thread, athyuttamre](https://news.ycombinator.com/item?id=48834405).) Treat as first-party but informal.

**In the API: three mechanisms, and only one of them reaches a different model.**

| Mechanism | Reaches a different model? | What crosses | What returns |
|---|---|---|---|
| **Agents SDK handoff** (`realtime_handoff`) | **No** | A `session.update` with the new agent's instructions/tools + a transfer message as tool output | Same session, same model, new persona |
| **Out-of-band response** (`response.create` with `conversation: "none"`) | **No** | A fresh instruction set, optionally a custom `input` array referencing existing items by id | A response tagged by `metadata`, never written to conversation state |
| **Delegation through tools** | **Yes** | Tool arguments + an explicit conversation-history snapshot | Tool output, fed back into the audio model's context |

The docs are unusually blunt that "handoff" is the wrong word for Argo's seam: *"Because the session stays live,
the model for that session does not change during a handoff... Realtime handoffs are primarily for swapping
between `RealtimeAgent` configurations on the same session."* Read from the Python SDK source, a handoff is
literally a tool call whose execution swaps `self._current_agent` and pushes new session settings
(`agents/realtime/session.py`). **Vocabulary caution for the spec: do not say "handoff" for the router seam.**

**What actually crosses, concretely.** From `getNextResponseFromSupervisor` in OpenAI's reference repo:

- *Out:* the realtime session's history filtered to `type === 'message'`, JSON-serialised, plus a single string
  parameter `relevantContextFromLastUserMessage` — described as *"Key information from the user described in
  their most recent message... as the last message might not be available."* The front-end model is instructed to
  keep it *"as concise as absolutely possible, and can be an empty string."*
- *Who decides:* the audio model, via prompt. Its instructions invert the default — *"By default, you must always
  use the getNextResponseFromSupervisor tool to get your next response, except for very specific exceptions,"*
  with a short allow-list (greetings, chitchat, "can you repeat that", and collecting parameters for the
  supervisor's tools).
- *Inside:* the supervisor runs its own agentic tool loop (`gpt-4.1` in the demo) — function calls and results are
  appended and the model re-run until it emits a message.
- *Back:* `{ nextResponse: <text> }` — a finished, voice-shaped, user-facing sentence.

The JS docs' variant returns a **structured output** instead (a Zod schema with `reason` and `refundApproved`),
JSON-stringified as tool output. So both shapes are sanctioned: prose-to-be-spoken, or structured intent the
audio model narrates.

### 3. Covering the wait

**This is the most transferable finding in the pass, and the answer is: the wait is deliberately designed, and
it is spoken.**

- **Mandatory, outcome-neutral filler.** OpenAI's reference chat agent: *"Before calling
  getNextResponseFromSupervisor, you MUST ALWAYS say something to the user... Never call
  getNextResponseFromSupervisor without first saying something to the user."* And crucially: *"Filler phrases must
  NOT indicate whether you can or cannot fulfill an action; they should be neutral and not imply any outcome."*
  The sample set is six short phrases ("Just a second." / "Let me check." / "One moment." / "Let me look into
  that." / "Give me a moment." / "Let me see."). *"This is required for every use... without exception. Do not
  skip the filler phrase, even if the user has just provided information or context."*
- **It is a model-level behaviour now, not a prompt trick.** *"`gpt-realtime-2` generates preambles by default.
  Start by testing the default behavior."* The prompting guide gives a full preamble policy with when-to,
  when-not-to, style, and length: use one when *"you are about to call a tool that may take noticeable time"*,
  when reasoning multi-step, when checking records, *"you are preparing an escalation or handoff"*, or when
  *"silence would make the assistant feel unresponsive."* Skip it when the answer is immediate, when the user is
  merely confirming, when audio is unclear, when the latest audio is silence/noise/TV/side-conversation, or when
  *"the tool call is lightweight and the user would not benefit from an update."* Style: *"describe the action,
  not the internal reasoning; avoid filler."* Explicitly banned openers include "Let me think...", "Hmm...", "One
  moment while I process that...". Length: *"Use one short sentence. Do not exceed two short sentences unless the
  user needs an explanation before a high-impact action."*
  ([Using realtime models](https://platform.openai.com/docs/guides/realtime-models-prompting).)
- **It has its own channel and its own event field.** `gpt-realtime-2` emits `commentary` (preambles and tool
  calls, user-visible) separately from `final` (the answer), and `response.done` carries a `phase` of
  `commentary` or `final_answer` so *"commentary can be played or displayed as a short intermediate update, while
  `final_answer` can be reserved for the assistant's completed response."* `phase` shipped to the Responses API
  on 2026-02-24. **This is the mechanical distinction Argo has been describing informally as "the cue" vs "the
  kernel."**
- **Permission to stay silent is also a first-class construct.** The guide recommends a no-op `wait_for_user`
  tool for audio that should not get a spoken reply, *"instead of making it say things like 'I'm here' or 'I
  didn't catch that'"*, paired with an instruction block that bans exactly those phrases. Product-side, *"If you
  ask it to stay quiet and listen, it will"*, and you can open with "Wait until I ask you to respond."
- **What latency is actually covered.** ~2 s in OpenAI's own annotated demo (filler-end to answer-start). For
  ChatGPT/GPT-Live no figure is published. For calibration against Argo's own numbers: #193 measured warm
  subscription-CLI reshaping at ~1 s TTFT and agent-loop CLIs at ~3–5 s full-turn. A single short filler
  sentence covers OpenAI's ~2 s comfortably; it does **not** cover a 3–5 s agent loop, and nothing in these
  sources describes a second-tier "still working" utterance. That gap is Argo's to design.
- **Interjection during the wait.** In ChatGPT it is claimed unconditionally — *"Live can listen and speak at the
  same time, so you can interrupt or continue speaking while ChatGPT is responding."* In the SDKs it depends on
  the harness (see §5 and the SDK divergence noted above).

### 4. Speaking a reasoning model's output

- **Reshaping happens, and in OpenAI's reference it happens *before* the seam.** The supervisor is prompted for
  voice output directly: concise, prose, *"never create bulleted lists"*, *"Prioritize brevity and clarity over
  completeness"*, *"only mention a couple of the most important items and summarize the rest at a high level"*,
  and *"When possible, please provide specific numbers or dollar amounts to substantiate your answer"* — a
  verbatim-for-values carve-out that maps onto #199 rule 4. The audio model is told to read the result verbatim,
  though the worked example in the prompt shows it lightly re-voicing rather than parroting.
- **Where the API puts it instead.** For teams not using the supervisor pattern, the prompting guide puts a
  per-type verbosity table in the *audio* model's prompt: *"Direct answers: Use 1-2 short sentences. Clarifying
  questions: Ask one question at a time. Tool results: Summarize the result first, then give only the next useful
  action. Product or option comparisons: Include key differences, tradeoffs, and who each option fits.
  Troubleshooting: Give one step at a time unless the user asks for the full procedure."* That is a
  five-row output taxonomy with per-type rules — the same construction as #192's five-type table, arrived at
  independently, and the "comparisons" row is #192's option-fidelity rule almost exactly.
- **Reasoning is never voiced, and OpenAI says so twice.** *"Preambles aren't hidden chain-of-thought. They're
  short spoken updates such as 'I'll check that order now.' Don't ask the model to reveal private reasoning."*
  And in the preamble style rules: *"describe the action, not the internal reasoning."* **Gemini diverges here:**
  `includeThoughts: true` surfaces thought summaries from a Live session
  ([Live API capabilities](https://ai.google.dev/gemini-api/docs/live-guide)). So "is the thinking speakable" is
  a live design question with two vendor answers, not a settled no.
- **Long or structured answers.** The screen carries them and the ear does not. Structure that cannot be spoken
  goes to widgets — *"Some answers are more useful when you can see them. While you're talking, ChatGPT can now
  show rich visual cards"* — while the spoken channel is held to prose with no lists. This is #190's "screen
  stays ground truth for the eyes" as a shipped product decision rather than a principle.

### 5. Interruption across the seam

**Interruption of speech is thoroughly specified. Interruption of *delegated work* is not specified anywhere,
and reading the source says it does not happen.**

Speech-side, documented:

- With VAD on, *"Realtime API handles interruptions... it detects user speech, cancels the ongoing response, and
  starts a new one."* WebRTC/SIP truncate unplayed audio server-side; WebSocket clients must stop playback and
  send `conversation.item.truncate` with an `audio_end_ms` so the model knows where it was cut off — *"so it can
  continue the conversation naturally (for example if the user says 'what was that last thing?')."*
  ([Realtime conversations](https://platform.openai.com/docs/guides/realtime-conversations).)
- Truncation is lossy in a way Argo should note: *"the realtime model doesn't have enough information to
  precisely align transcript and audio"*, so truncation *"will cut the audio at a given place and remove the text
  transcript for the unplayed portion"* — and in the JS SDK's history caveats, *"Responses truncated by
  interruption do not retain a final transcript."* Partial spoken output is **not** kept as text.
- The SDK emits `audio_interrupted`; for remote/delayed playback OpenAI recommends `RealtimePlaybackTracker` so
  truncation is based on what was actually *heard* rather than what was generated.

Delegation-side, **read from source, not from prose docs**: in the Python SDK a delegated tool call is dispatched
via `asyncio.create_task` into a tracked set (`_tool_call_tasks`), commented *"Run tool calls in the background to
avoid blocking realtime transport."* Those tasks are cancelled only in `_cancel_background_tasks()`, which is
called from `_cleanup()` — i.e. at **session close**. Barge-in cancels the audio *response*; it does not cancel
the in-flight delegated task, which completes and returns its output. No documented API cancels a delegated call
mid-flight. **For Argo:** #198 settles that an in-flight *spoken answer* is dropped at toggle-off; there is no
precedent for what to do with an in-flight *delegated turn*, and the default everywhere is "it finishes anyway."
That is a gap worth a ticket.

Two adjacent controls exist that could serve as a cancellation surrogate: `backgroundResult()` (JS — deliver the
output without triggering a response), and function-tool timeouts (`timeoutMs`, `timeoutBehavior`, with
`error_as_result` sending the timeout message as tool output by default).

### 6. Comparison sweep

**Gemini Live — reasoning in the backbone, but the best-specified return path.**
Thinking is a dial on the audio model itself (`thinkingLevel: minimal | low | medium | high`, *"the default is
`minimal` to optimize for lowest latency"*), not a delegation. No first-party source describes Gemini Live
delegating to a separate reasoner; Gemini 3.1 Flash Live (2026-03-26) is pitched on in-model reasoning and tool
use, leading ComplexFuncBench Audio at 90.8% and Audio MultiChallenge at 36.1% *"with 'thinking' on."*
([Gemini 3.1 Flash Live](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live/).)
Where Google is *ahead* of OpenAI is the seam's re-entry policy: `behavior: NON_BLOCKING` plus a per-result
`scheduling` of `INTERRUPT` / `WHEN_IDLE` / `SILENT`, and a `proactive_audio` flag letting the model *"proactively
decide not to respond if the content is not relevant."* Gemini has turned #194's open question into API surface.

**Claude — no seam at all, by a decision taken three weeks ago.**
Voice mode runs the same Claude models as text chat (Opus / Sonnet / Haiku, switchable mid-conversation), uses
*"the fastest version of whichever model you've selected"*, and is turn-based: *"Claude listens, pauses to think,
and then responds."* Text↔voice switching preserves context within one conversation. Connected tools work in
voice and Claude *"will ask for permission before using one of your connected tools."* No audio model, no
delegation, no filler layer, no widgets. And directly relevant to #190's framing: **voice mode is not available
in Claude Code or Cowork — dictation only** — which keeps #191's finding intact that voice-*in* is the commodity
and the return path is the gap.

**Where they diverge, in one line each.** OpenAI: fast audio model + delegate frontier work, cover the wait with
speech. Google: one audio model that thinks, with an explicit policy for when a background result gets spoken.
Anthropic: no audio model — put the frontier model in the loop and accept turn-taking.

### 7. Stated limits

**Vendor-stated (GPT-Live / ChatGPT Voice):**

- No video or screen sharing at launch (Advanced Voice Mode retained for those); no connectors/plugins in Live at
  launch; not available with custom GPTs (those still use AVM and the Shimmer voice); no image generation, data
  analysis, or custom actions in GPT voice conversations. Live *"cannot currently find or add files from your
  ChatGPT Library."*
- One voice conversation at a time; a single Live conversation caps at 2 hours; conversations can end on usage
  limit, session length, or *"when a long conversation reaches its context limit."*
- *"Live is designed primarily for one-on-one conversation... it is not yet optimized for conversations with
  multiple speakers. It may respond when people are speaking to one another instead of to ChatGPT."*
- Interruptions still misfire: *"Interruptions can still happen, especially with background noise, long pauses,
  or audio from another speaker."* And on being asked to wait: *"Long pauses, background speech, or other sounds
  may still cause Live to respond."*
- Transcripts are not ground truth: *"A transcript is added to the chat after a Voice conversation. It may not
  exactly match what you or ChatGPT said."*
- Non-native accent / fluency gaps in some languages. Preset personalities do not apply to Live. No precise
  playback-speed control.
- System card regressions, both stated as not statistically significant: GPT-Live-1 emotional reliance 0.88→0.82
  vs AVM; GPT-Live-1 mini sexual content 0.97→0.95. Preparedness assessment was run on the models
  *"when operating without delegation"*, with delegated work inheriting the target model's safeguards.

**API-side limits relevant to the seam:** input-audio transcription *"is best treated as a rough guide to what
the user said, not an exact copy of how the model interpreted the audio"*; you cannot edit function tool calls
after the fact; guardrails run on debounced transcript text so *"some audio may already be buffered when the
tripwire fires"*; `gpt-realtime-2` context is 128k (up from 32k).

**User-reported (secondary, used only as report-of-experience):**

- Continuity/identity break when moving from a text chat into voice — the *"separate layer inserted into the
  conversation"* report above (2026-05-17), asking that the behavioural difference *"should be clearly
  disclosed."*
- Still interrupts too much for language learning, and hold-to-talk keeps disappearing
  ([forum, 2026-07-09](https://community.openai.com/t/chatgpt-live-voice-still-interupts-too-much-what-happened-to-hold-to-talk/1386172)).
- An early GPT-Live bug where it laughed at and talked over the user, reported as *"rude and condescending"*,
  since clamped down (HN, day-of-launch).
- Tonal regression: some users find the remastered voices flatter than AVM (widely reported; no primary source).
- The most-requested missing capability is precisely Argo's use case — GPT-Live over project/codebase context —
  logged by OpenAI support on 2026-07-22 as *"GPT-Live support inside Projects, ChatGPT Work, and Codex, with the
  ability to keep talking while tasks are being carried out"*, and partially shipped on 2026-07-23.

---

## Not documented — stated as such rather than inferred

- **The GPT-Live↔GPT-5.5 wire format.** Whether the audio model emits a tool call, a structured intent, or
  something else; whether the reasoner receives audio, a transcript, or a summary; whether it returns prose to be
  spoken or structured data to be narrated. None of it is published. Everything in §2's concrete table is the
  *developer-facing* API, which OpenAI has not claimed is what ChatGPT uses.
- **Who decides to delegate in ChatGPT** — model-side, a classifier, or the Intelligence setting alone.
- **Whether GPT-Live re-voices GPT-5.5's answer verbatim or reshapes it.** Unpublished. The reference
  implementation says verbatim; the product says nothing.
- **What happens to an in-flight GPT-5.5 delegation when you barge in, in ChatGPT.** Unpublished. The SDK-level
  behaviour (§5) is read from source, not from prose docs, and may not reflect the product.
- **Any latency figure for GPT-Live's delegation.** The only published number in this space is the ~2 s in the
  Chat-Supervisor demo, which uses different models on a different stack.
- **Whether the delegated model's tool activity is surfaced on screen** during a ChatGPT voice turn (widgets are
  documented; a work/progress surface is not).

## Flagged, not recommended — belongs to ADR-0007 / #196

Per this map's scope boundaries, these bear on audio-model selection or plumbing and are noted only:

- **Out-of-band responses as the user-intent capture mechanism** (ADR-0007 open question #4). OpenAI recommends
  re-running the *same* audio model with `conversation: "none"` rather than a parallel ASR, at 3–5× ASR cost per
  turn. Whether Moshi/PersonaPlex admit an equivalent second pass is a spike question.
- **GPT-Live is cloud-only and not in the API** ("we also plan to bring them to the API soon"). It says nothing
  about on-device viability and does not move #196's Moshi-vs-PersonaPlex decision.
- **`reasoning.effort` as a product-visible dial.** ChatGPT exposes Instant/Medium/High to the *user*. If Argo's
  audio model ever gains an effort dial, whether it is user-visible is a spec question this map may want later.
- **Interrogation-over-visual has shipped.** ChatGPT desktop's Screen context / "Take a look at this" appshot
  grabs the frontmost window's image *and* accessible text including off-screen scroll content. #190 parks this
  posture in fog; it is no longer speculative, and the incumbent's version is screenshot-plus-a11y-tree.

## Caveats

Snapshot of a field moving in weeks, not months: GPT-Live is 17 days old, ChatGPT Voice in Work and Codex is 2
days old, Claude's voice-mode model change is 2 days old. GPT-Live is not in the API, so nothing here about its
seam can be verified by building against it; the API mechanisms documented in §2 are OpenAI's *developer* answer
and may differ from what ChatGPT runs. The Chat-Supervisor repo is a reference demo, not production code, and its
~2 s figure is one annotated screenshot on `gpt-4o-realtime-mini` + `gpt-4.1` — treat it as an order of magnitude,
not a benchmark. Marketing language ("keeps talking while it works") has been separated from documented mechanism
throughout, but the two are not independently verifiable for the product. Three claims are read from SDK source
rather than prose docs and are labelled where they appear.

## Key sources

**OpenAI — product & safety**
[Introducing GPT‑Live](https://openai.com/index/introducing-gpt-live/) (2026-07-08) ·
[GPT-Live System Card](https://deploymentsafety.openai.com/gpt-live) (2026-07-08) ·
[ChatGPT Voice Help Center](https://help.openai.com/articles/20001274) ·
[ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) (2025-11-25 in-chat
voice; 2026-07-08 GPT-Live-1; 2026-07-23 Voice in Work and Codex) ·
[ChatGPT Voice — Codex docs](https://learn.chatgpt.com/docs/features/voice) ·
[How OpenAI delivers low-latency voice AI at scale](https://openai.com/index/delivering-low-latency-voice-ai-at-scale/)

**OpenAI — API & SDK**
[Using realtime models (prompting guide)](https://platform.openai.com/docs/guides/realtime-models-prompting) —
preambles, reasoning effort, channels, `phase`, verbosity, `wait_for_user` ·
[Realtime conversations](https://platform.openai.com/docs/guides/realtime-conversations) — out-of-band responses,
interruption & truncation ·
[Voice agents](https://developers.openai.com/api/docs/guides/voice-agents) ·
[API changelog](https://platform.openai.com/docs/changelog) — `gpt-realtime-2.1` 2026-07-06, `phase` 2026-02-24 ·
[Agents SDK (Python) realtime guide](https://openai.github.io/openai-agents-python/realtime/guide/) and
[`agents/realtime/session.py`](https://github.com/openai/openai-agents-python/blob/main/src/agents/realtime/session.py) ·
[Agents SDK (JS) voice agents — delegation through tools](https://openai.github.io/openai-agents-js/guides/voice-agents/build/) ·
[openai-realtime-agents — Chat-Supervisor](https://github.com/openai/openai-realtime-agents) and
[`chatSupervisor/index.ts`](https://github.com/openai/openai-realtime-agents/blob/main/src/app/agentConfigs/chatSupervisor/index.ts) /
[`supervisorAgent.ts`](https://github.com/openai/openai-realtime-agents/blob/main/src/app/agentConfigs/chatSupervisor/supervisorAgent.ts) ·
[Realtime out-of-band transcription cookbook](https://cookbook.openai.com/examples/realtime_out_of_band_transcription)

**Google**
[Live API capabilities guide](https://ai.google.dev/gemini-api/docs/live-guide) — `thinkingLevel`,
`includeThoughts`, proactive audio ·
[Live API tools](https://ai.google.dev/gemini-api/docs/live-tools) — `NON_BLOCKING`, `scheduling` ·
[Gemini 3.1 Flash Live](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live/) (2026-03-26)

**Anthropic**
[Think through hard problems in voice mode](https://claude.com/blog/think-through-hard-problems-in-voice-mode) (2026-07-23) ·
[Use voice mode](https://support.anthropic.com/en/articles/11101966-using-voice-mode-on-claude-mobile-apps)

**Secondary — dating and user reports only**
[HN: GPT‑Live](https://news.ycombinator.com/item?id=48834405) (incl. OpenAI engineer on delegation topology) ·
[OpenAI forum: Voice/Live continuity feedback](https://community.openai.com/t/i-want-to-add-serious-feedback-about-the-current-chatgpt-voice-live-experience/1381176) ·
[OpenAI forum: interruption / hold-to-talk](https://community.openai.com/t/chatgpt-live-voice-still-interupts-too-much-what-happened-to-hold-to-talk/1386172) ·
[OpenAI forum: GPT-Live for Projects/Work/Codex](https://community.openai.com/t/gpt-live-as-the-voice-interface-for-projects-and-chatgpt-work/1387597)
