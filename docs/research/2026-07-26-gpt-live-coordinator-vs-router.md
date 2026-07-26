# Does GPT Live coordinate sessions itself — is the separate router redundant?

**Date:** 2026-07-26 · **For:** wayfinder [#221](https://github.com/milad-alizadeh/argo/issues/221), part of map [#190](https://github.com/milad-alizadeh/argo/issues/190) · **Status:** desk research, primary sources (source-read)

**Question.** Map #190 assumes a two-model seam: GPT Live owns the mic, a Claude **router** coordinates worker
sessions and condenses their dense output into the spoken line ([#212](https://github.com/milad-alizadeh/argo/issues/212)).
[#214](https://github.com/milad-alizadeh/argo/issues/214) found OpenAI quietly retiring the split, and direct
observation on [#216](https://github.com/milad-alizadeh/argo/issues/216) showed a coordinator writing precise
briefs to worker chats without establishing *which model* wrote them. This pass settles, from source, who
authors each leg — and whether the router is redundant.

**Method.** Primary sources only. The load-bearing evidence is a **source read of `openai/codex`** at
`61a4488` (2026-07-26), the shipped client of ChatGPT Voice's delegation path — the same route that produced
#210's correction. Docs are used second: OpenAI's Realtime API reference and guides, the `openai-python` v2.48.0
and `openai-node` typed event schemas, both Agents SDKs' docs *and* source (`openai-agents-python` @ `f663a06`,
`openai-agents-js` @ `15b376e`, both 2026-07-26), the GPT-Live-1 system card, ChatGPT Voice product docs, and
Google's Gemini Live API docs for the comparison point. A ChatGPT voice chat's self-report of its own
architecture is recorded as its own evidence class, below, and is **not** treated as a finding. Where source and
self-report disagree, source wins, and the disagreement is stated.

**Two methodology traps worth recording, because both silently corrupt this exact research.**
`platform.openai.com/docs/*` now 301-redirects to `developers.openai.com/api/docs/*`, and **appending `.md` to
any of those URLs returns the authoritative full markdown**. Use it: the `r.jina.ai` mirror of the prompting
guide is **silently truncated** — 31,502 bytes against the real 85,820 — and fetch/search summarizer models
returned quotes from that page that could not be verified against the real text. Separately,
`openai.com/index/introducing-gpt-live/` is behind a Cloudflare JS challenge (403 to fetchers, and to curl under
both browser and Googlebot user agents), so the launch post could not be read first-hand in this pass; the
widely repeated secondary claim that GPT-Live *"delegates to GPT-5.5"* is **not** corroborated by any primary
source read here, and is not used below.

All `file:line` references are relative to `codex-rs/` in `openai/codex` at `61a4488` unless another repo is named.

---

## Bottom line

**The router is not redundant, but it is not the condenser either — and that second half breaks a decision the
map has already recorded.**

Reading OpenAI's shipped client end to end produces a seam that is the *mirror image* of the one #212 resolved:

1. **The audio model is forbidden from authoring the inbound brief.** Its only delegation tool says, verbatim:
   *"Do not rephrase the user's ask or rewrite it in your own words; pass along the user's own words."*
   The audio model is a pass-through on the way in.
2. **The audio model is mandated to condense on the way out.** Its own system prompt says *"Briefly tell the
   user the key takeaway, status, or next step without repeating visible content"* and *"Do not read out or
   recreate tables, diffs, plots, code blocks, structured data, or other heavily formatted content by default."*
3. **The text agent is told this will happen to it.** The instruction injected into the delegated Codex agent
   when a voice session opens reads: *"Any response you produce will be consumed by the intermediary and **may
   be summarized** before the user sees it."*

So on OpenAI's stack the **audio model is the reshaper**, not the reasoner. #212 resolved the opposite — that
the router condenses and the audio model does not re-author — and ADR-0007 consequence #4 was amended on the
strength of a `Thinking`-default reading that turns out to understate the problem: the default is not merely
"no channel, audio model decides." The audio model is under a **standing instruction not to repeat** the
router's words. OpenAI's current prompting guide says the same thing a third time, in its own voice: *"the
responder **must** rephrase the thinker's text into an audio-friendly response before generating audio."*

Three further findings, all decisive:

4. **The `speakable` channel is unreachable on the public Realtime API, and OpenAI says so in one line.**
   `codexResponseHandoffMode` — the mode selector carrying `speakable | commentary` — is documented as: *"This
   setting has no effect on V1 or V2"* (`app-server/README.md:997`), where **V2 is the public Realtime API**.
   The channel field is only ever serialized onto `delegation.context.append` / `session.context.append`, which
   exist only on the alpha `/v1/live` wire. There is no verbatim-read mode on the surface ADR-0007 commits v1 to.
5. **The router's three claimed non-summarizing jobs survive scrutiny — two confirmed, one confirmed but
   misplaced.** Task state: confirmed, and load-bearing. Brief scoping: confirmed, and *stronger* than claimed —
   the audio model is prohibited from it. Policy enforcement: confirmed as a router job, but the source puts it
   on the **inbound** leg, not "before the summary goes to GPT Live."
6. **A naming correction that matters for the ADR: Argo cannot ship on GPT Live, because GPT Live has no API.**
   OpenAI's own funnel page is a waitlist — *"We're bringing GPT-Live-1 and GPT-Live-1 mini to the API soon.
   Developers and enterprises can sign up to be notified"*
   ([form](https://openai.com/form/gpt-live-1-in-the-api/), [@OpenAIDevs](https://x.com/OpenAIDevs/status/2074915334377844896)).
   The audio leg ADR-0007's amendment actually commits v1 to is `gpt-realtime-*` on the public `/v1/realtime`,
   a **different model family** from the one #210 and #221 have been reasoning about. Every "GPT Live" in the
   map should be read as "the public Realtime API" until that waitlist opens.

**Verdict on the ticket's headline question.** GPT Live does not coordinate sessions itself; in OpenAI's own
stack it cannot — it holds two tools, neither of which can spawn or address a worker. The router is a
coordinator and a state-holder, and it is *not* redundant. But the map's assumption that the router is also the
**condenser** is wrong at the incumbent, and #199 rule 7's guard is enforced on the wrong side of the seam
exactly as #221 feared.

---

## Findings

Numbered, standalone, each with its source.

### The seam in OpenAI's shipped client

1. **The audio model's entire tool surface on the public Realtime API is two functions.**
   `background_agent({prompt: string})` and `remain_silent({})` — nothing else, `tool_choice: "auto"`
   (`codex-api/src/endpoint/realtime_websocket/methods_v2.rs:115-142`). It cannot spawn a worker, address one
   by id, wait on one, or read one's transcript.

2. **The audio model is explicitly instructed not to author the brief.** The `background_agent` tool
   description (`methods_v2.rs:34`): *"Send a user request to the background agent. Use this as the default
   action. **Do not rephrase the user's ask or rewrite it in your own words; pass along the user's own words.**
   If the background agent is idle, this starts a new task and returns the final result to the user. If the
   background agent is already working on a task, this sends the request as guidance to steer that previous
   task."* Its one parameter is described as *"The user request to delegate to the background agent"*
   (`methods_v2.rs:120-124`) — a *request*, not a brief.

3. **On the alpha wire the inbound payload is the user's transcript, and the field is named as such.** The
   `delegation.created` server event's content is parsed into `input_transcript`, filtered to
   `type == "input_text"`, guarded on `item.type == "delegation" && item.target == "client"`
   (`codex-api/src/endpoint/realtime_websocket/protocol_frameless_bidi.rs:73-95`). The client wraps it as
   `<realtime_delegation><input>…</input><transcript_delta>…</transcript_delta></realtime_delegation>` with
   `role: "user"` (`core/src/context/realtime_delegation.rs:30-57`). Nothing in the path lets the audio model
   substitute authored text for the transcript.

4. **The alpha wire gives the audio model no tools at all.** The `session.update` payload on the
   `FramelessBidi` (V3, `/v1/live`) path carries `instructions`, `audio.output.voice`, and
   `"delegation": {"type": "client"}` — and no `tools` key
   (`codex-api/src/endpoint/realtime_websocket/methods_frameless_bidi.rs:45-88`). The dedicated event replaced
   the function tool entirely.

5. **`backend_prompt.md` is the AUDIO model's system prompt, despite its name.**
   `prepare_realtime_backend_prompt()` (`core/src/realtime_prompt.rs:5-24`) returns `BACKEND_PROMPT`
   (`prompts/src/realtime.rs:1` → `prompts/templates/realtime/backend_prompt.md`), which becomes
   `RealtimeSessionConfig.instructions` (`core/src/realtime_conversation.rs:1224`, `:1307`) and is sent as
   `session["instructions"]` on `session.update`. Its own text confirms the placement: *"The backend handles
   execution and produces user-visible artifacts. **You are the conversational surface of the same system.**"*
   Add this to #210's four-names-for-one-thing list: "backend prompt" means *the prompt the Codex backend hands
   to the realtime model*, not the prompt for the backend.

6. **The audio model is mandated to condense the return leg, and mandated *not* to read it out.** From the same
   file, section **"Presenting backend results"**: *"Treat backend-visible output as the primary surface.
   Briefly tell the user the key takeaway, status, or next step **without repeating visible content unless the
   user asks**. **Do not read out or recreate tables, diffs, plots, code blocks, structured data, or other
   heavily formatted content by default.** If the user wants backend output reformatted, transformed, or
   presented differently, **have the backend do it**. Present backend content in detail only when the user
   explicitly asks."*

7. **The delegated text agent is told its output will be summarized by the audio model.** `realtime_start.md`
   (`prompts/templates/realtime/realtime_start.md`), injected into the Codex thread as
   `RealtimeStartInstructions` when a voice session opens: *"You are operating as a **backend executor behind an
   intermediary**. The user does not talk to you directly. **Any response you produce will be consumed by the
   intermediary and may be summarized before the user sees it.** … Keep responses concise and action-oriented.
   Your updates should help the intermediary respond to the user."* This is the same fact stated from the other
   side of the seam, and it settles Q2 against #212's resolution.

8. **Backend output is truncated before the audio model ever sees it — to ~1,000 tokens.**
   `REALTIME_ASSISTANT_OUTPUT_TOKEN_BUDGET: usize = 1_000` (`core/src/realtime_conversation.rs:92`), applied in
   `realtime_backend_output()` (`:1338-1341`) and `realtime_backend_item()` (`:1343-1349`). On the alpha wire
   the text is then re-chunked at `CONTEXT_APPEND_MAX_BYTES: usize = 500` on UTF-8 boundaries
   (`methods_frameless_bidi.rs:11`, `:98-114`) — the return path is a **stream of ≤500-byte appends, not one
   blob**. So there are at least two lossy steps before generation even begins.

9. **On the public Realtime API, backend text is injected as a `user`-role message, not as speech.** On
   `RealtimeEventParser::RealtimeV2`, every outbound variant — `StandaloneHandoff`, `StandaloneSpeech`,
   `HandoffUpdate`, `HandoffAppend` — is delivered via
   `send_conversation_item_create(text, ConversationTextRole::User)`, prefixed `[BACKEND] `, followed by a
   queued `response.create` (`core/src/realtime_conversation.rs:2025-2072`; prefix constant
   `REALTIME_BACKEND_TEXT_PREFIX` at `:102`). Even `StandaloneSpeech` — the app-server's explicit
   `thread/realtime/appendSpeech`, documented as *"append text that the realtime model **should** speak to the
   user"* (`app-server/README.md:181`, note the hedge) — takes this route on the public API.

10. **The function-tool return on the public API is a pointer, not content.** When the background agent
    finishes, `CompletedHandoff` discards its text (`text: _`) and sends as `function_call_output` the fixed
    string `REALTIME_V2_HANDOFF_COMPLETE_ACKNOWLEDGEMENT` = *"Background agent finished. Use the preceding
    [BACKEND] messages as the result."* (`core/src/realtime_conversation.rs:2073-2088`, constant at `:103-104`).
    OpenAI's own client does not attempt to pass answer text through the tool return at all.

11. **One function states the dialect contrast outright — the channel is the alpha's only extra degree of
    freedom.** `codex-api/src/endpoint/realtime_websocket/methods_common.rs:92-109` dispatches the *same*
    delegated-worker output three ways: `V1` → `conversation.handoff.append` with an
    `"Agent Final Message"` prefix; `FramelessBidi` → `delegation.context.append` **carrying the channel**;
    `RealtimeV2` → a plain `function_call_output` with **no channel parameter at all**.

12. **`speakable` is alpha-only, and OpenAI documents the fact in one sentence.**
    `RealtimeContextAppendChannel::{Speakable, Commentary}`
    (`codex-api/src/endpoint/realtime_websocket/protocol.rs:29-35`) is only ever attached by
    `with_context_append_channel()` (`methods.rs:301-304`), and is only serialized onto
    `delegation.context.append` and `session.context.append` (`protocol.rs:63-74`) — both `FramelessBidi`-only
    messages. `app-server/README.md:997`: *"This setting has no effect on V1 or V2."* README line 178 fixes the
    mapping: *"`v2` uses the Realtime Voice API"* — i.e. V2 is the public surface.

13. **The word "verbatim" does not appear anywhere in codex's realtime path.** A case-insensitive sweep of
    `codex-rs/**/*.rs` and `**/*.md` returns only Windows path handling, markdown rendering, and history-replay
    test names — nothing in `realtime_*`, `context/realtime_*`, or `prompts/templates/realtime/`. The shipped
    client abandoned the concept; the stale reference repo (finding 19) did not.

### What the public Realtime API documents

14. **The public Realtime API documents that a tool result is re-generated, not spoken.**
    *"Given this information, we can execute code in our application to generate the horoscope, and then provide
    that information back to the model **so it can generate a response**"* and *"Once we have added the
    conversation item containing our function call results, we again emit the `response.create` event from the
    client. **This will trigger a model response using the data from the function call.**"*
    ([realtime-conversations](https://developers.openai.com/api/docs/guides/realtime-conversations.md).) The
    field itself is typed as unconstrained free text: *"The output of the function call, this is free text and
    can contain any information or simply be empty"*
    (`openai-python` v2.48.0 `src/openai/types/realtime/realtime_conversation_item_function_call_output.py:17-21`).

15. **OpenAI's prompting guide names paraphrase-of-tool-output as a known, expected failure.**
    *"Some tool outputs, especially long strings that must be repeated verbatim, can be out-of-distribution for
    the model… If your tool returns a raw string and separately asks the model to 'repeat exactly,' **the model
    may be more prone to paraphrasing, truncation, or blending in its own preamble**"*
    ([realtime-models-prompting](https://developers.openai.com/api/docs/guides/realtime-models-prompting.md),
    §"Tool Output Formatting", in the **Realtime 1.5** half). The trigger it names for the remedy is *"you
    observe truncation, paraphrasing, dropped fields, reordering, or the model blending in its own
    preamble/commentary."*
    **A correction to #210 while we are here:** the guide's line *"Tool results: Summarize the result first,
    then give only the next useful action"* is **recommended prompt text you author** — it sits inside a
    `## Verbosity` block the 2.0 half tells you to paste into your own prompt — not a statement of default
    model behaviour. #210 quoted it accurately but read it as behaviour. The behavioural claim is the
    paraphrase-risk sentence above, and that one is unambiguous.

16. **The guide's *only* responder-thinker guidance instructs the responder to rephrase — the opposite of
    verbatim.** §"Rephrase Supervisor Tool (Responder-Thinker Architecture)", also Realtime 1.5 half: *"In many
    voice setups, the realtime model acts as the responder (speaks to the user) while a stronger text model acts
    as the thinker… **Text replies are not automatically good for speech, so the responder must rephrase the
    thinker's text into an audio-friendly response before generating audio.**"* Its recommended prompt block
    spells the reshaping out — *"Keep it short: no more than 2 sentences"*, an opener + one-sentence gist + ≤3
    details template, and number normalisation for speech (*"$45.20" → "forty-five dollars and twenty cents"*).
    Its stated trigger is *"When the responder's spoken output sounds robotic, too long, or awkward after
    receiving a thinker response."* **This is a third independent OpenAI source putting the reshaper on the
    audio side**, and unlike the reference repo it is current.

17. **`require_repeat_verbatim` is not an API field.** It is a key OpenAI suggests you invent *inside your own
    tool's output JSON*, documented purely as a distribution-shaping prompting convention — *"Wraps the tool
    output in a small, explicit JSON envelope (e.g., `response_text` plus flags like `require_repeat_verbatim`,
    `format`, or `content_type`) so the response looks more **in-distribution**"* — with soft guarantee language
    throughout (*"the model generally has an easier time"*). Same page, §"Tool Output Formatting". Search
    engines surface it as though it were a parameter. It is not.

18. **An assistant-role item with pre-authored text is context, not speech, and the reference says so.**
    *"This event can be used both to populate a 'history' of the conversation and to add new items mid-stream,
    but **has the current limitation that it cannot populate assistant audio messages**"*
    ([realtime-client-events](https://developers.openai.com/api/docs/api-reference/realtime-client-events.md),
    `conversation.item.create`). Assistant message items support `text` content only. To produce speech you
    still issue `response.create`, which generates fresh audio.

19. **`response.create` has no parameter that constrains generation to a supplied string.** Full parameter set:
    `audio`, `conversation`, `input`, `instructions`, `max_output_tokens`, `metadata`, `output_modalities`,
    `parallel_tool_calls`, `prompt`, `reasoning`, `tool_choice`, `tools`
    (`openai-python` `src/openai/types/realtime/realtime_response_create_params.py:25`). The nearest affordance
    is the documented `instructions: "Say exactly the following: …"` with `input: []`, and `instructions` is
    typed: *"**The instructions are not guaranteed to be followed by the model**, but they provide guidance to
    the model on the desired behavior"* (`realtime_response_create_params.py:56-57`). Two near-misses that are
    *not* it: `interrupt_response` is turn-detection / barge-in only
    (`realtime_audio_input_turn_detection.py:47`), and `metadata` is 16 arbitrary bookkeeping key-value pairs
    with no effect on generation (`:70-78`).

20. **A `commentary | final` channel *does* exist on the public API — but it runs the wrong direction.** The
    2.0 half of the prompting guide: *"gpt-realtime-2 can produce user-visible intermediate messages in the
    commentary channel and final user-facing responses in the final channel"*, surfaced as
    `response.done.phase` of `commentary` or `final_answer`. This classifies **the audio model's own generated
    output**. It is not an input channel for tool results and cannot carry a string we want spoken. The
    superficial name-match with the alpha's `speakable | commentary` is a false friend and should not be relied
    on by any Argo spec.

21. **The stale reference repo says "read verbatim" and then paraphrases in its own worked example.**
    `openai/openai-realtime-agents` last shipped `94c9e91`, **2026-01-07** (~6.5 months stale), hardcoding
    `gpt-4o-realtime-preview-2025-06-03` (`src/app/hooks/useRealtimeSession.ts:137`) with a `gpt-4.1` supervisor
    (`chatSupervisor/supervisorAgent.ts:285`) — pre-`gpt-realtime` on both sides. It instructs verbatim from
    both directions (*"provides a high-quality answer, which you should read verbatim"*, `chatSupervisor/index.ts:74`;
    *"Your message will be read verbatim by the junior agent"*, `supervisorAgent.ts:15`), but its **first
    few-shot example paraphrases** (`index.ts:92-93`: the tool returns *"…your last bill was $xx.xx, mainly due
    to $y.yy in international calls…"*, the demonstrated assistant line is *"…which is higher than your usual
    amount because of $x.xx in international calls…"*) while its second is verbatim. Even the canonical verbatim
    demo is internally inconsistent about it. Its tool return is a bare `{ nextResponse: string }`
    (`supervisorAgent.ts:316`) — exactly the under-specified shape the current guide warns about in finding 15.

22. **Neither Agents SDK has any verbatim affordance, and they diverge on whether a tool return even triggers
    speech.** Both deliver a tool return identically — serialize → `conversation.item.create` with
    `type: "function_call_output"` → `response.create`, i.e. **fresh generation**
    (`openai-agents-js/packages/agents-realtime/src/openaiRealtimeBase.ts:878-919`;
    `openai-agents-python/src/agents/realtime/openai_realtime.py:857-875`). `grep -rni verbatim` over both
    realtime packages and both docs trees returns **zero**. The divergence #210 found is real and pinnable:
    **JS ships `backgroundResult(output)`** — *"return tool results without triggering a new response"*
    (`packages/agents-realtime/src/tool.ts:11-33`, consumed at `realtimeSession.ts:858-866`) — while
    **Python hard-codes `start_response=True` on every function-tool return path**
    (`src/agents/realtime/session.py:1023-1036`, `:731-742`, `:756-769`, `:1085-1094`); the only
    `start_response=False` in the whole package is the tool-not-found error (`:1096-1104`). `grep -rn
    "background_result" py/src/` → zero hits. So in Python, **a function tool's return value always makes the
    audio model speak**, and there is no supported way to suppress it. Python's docs have no delegation section
    at all (`grep -rni "delegat\|supervisor" py/docs/realtime/` → zero hits); JS's has two.

### Coordination, containment, and the comparison point

23. **Fan-out to worker chats is a text-agent tool, on the Responses API, unreachable from the audio model.**
    `spawn_agent` lives in the `multi_agent_v1` `ResponsesApiNamespace`
    (`core/src/tools/handlers/multi_agents_spec.rs:68-100`, namespace constant `:14-15`) with a `message`
    parameter described as *"Initial plain-text task for the new agent"* (`:586-594`). That parameter **is** the
    brief. It is authored by the delegated text agent, which is also the only party holding the plan: *"First,
    quickly analyze the overall user task and form a succinct high-level plan… Do this planning step before
    delegating"* (`:718-722`).

24. **Worker results return to the coordinator as a tagged final answer, not to the audio model.**
    `InterAgentCompletionMessage` renders `"Message Type: FINAL_ANSWER\nTask name: …\nSender: …\nPayload:\n…"`
    with `role: "assistant"` into the **parent text agent's** history
    (`core/src/context/inter_agent_completion_message.rs:22-40`). The audio model never sees it. There are
    therefore **two** condensation hops in OpenAI's stack: worker → coordinator, then coordinator → audio model.

25. **The audio model is explicitly forbidden from acting as a policy gate; the router is the sole policy
    point.** `backend_prompt.md`, "Policies": *"Pass execution work to the backend. Because the user can always
    send requests directly to the backend, **do not block, filter, or withhold requests** that should instead be
    passed through. **NEVER refuse requests. Delegate all user requests to the backend. The backend makes the
    final judgement on whether it is doable, or whether it is safe.** Treat backend outputs as authoritative. Do
    not override or contradict them."* The GPT-Live-1 system card states the containment argument from the
    safety side: *"cybersecurity risk from the GPT-Live models themselves is highly constrained at launch
    because **these models lack broad access to tools independently of the models to which they delegate, and do
    not have code execution capability**"*, and *"delegated work will likewise receive the safeguards associated
    with the model to which work is delegated"*
    ([GPT-Live System Card](https://deploymentsafety.openai.com/gpt-live), 2026-07-08). This is ADR-0007's
    read-only containment argument, arrived at independently for the third time.

26. **`remain_silent` is OpenAI's answer to Gemini's `SILENT`, and it is the only one of the three they ship.**
    *"Call this when the best response is to say nothing. Use it instead of speaking after hidden system/control
    messages, **after background agent updates in silent modes**, or whenever acknowledging aloud would be
    distracting"* (`methods_v2.rs:36`). Gemini's `FunctionResponse.scheduling` carries all three, and Google is
    the only vendor with per-value semantics published: `SILENT` — *"the function response is added to the
    model's context, but the model doesn't generate a response for it, and any ongoing user interaction is not
    interrupted"*; `WHEN_IDLE` — *"the model generates a response… only when there is no active user
    interaction… waits for it to complete before generating a response to avoid interruption"*; `INTERRUPT` —
    *"the model generates a response… immediately, interrupting any ongoing user interaction"*, with the
    best-practice note *"Avoid INTERRUPT unless necessary."*
    ([GCP async function calling](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/asynchronous-function-calling).)
    #210's recommendation that Argo adopt a three-way vocabulary rather than a boolean is unchanged.
    ⚠️ **Two caveats that weaken Gemini as a model to copy.** `NON_BLOCKING` and `scheduling` are **2.5-only —
    explicitly *not supported* on Gemini 3.1 Flash Live**: *"Function calling is sequential only. The model will
    not start responding until you've sent the tool response"*
    ([live-guide](https://ai.google.dev/gemini-api/docs/live-guide)). And the two primary Google docs
    **disagree on where `scheduling` goes** — `ai.google.dev` nests it inside `response`, `docs.cloud.google.com`
    makes it a sibling. Untested here.

27. **Gemini Live has no verbatim-speech affordance either — and its model-role turns explicitly do not
    speak.** Zero hits for `verbatim`, `speak this`, `say exactly`, `read out`, `exact text` across
    `live-tools`, `live-guide`, `live`, `/api/live`, `live-session`; and no statement anywhere about how it
    realizes a function response. Model-role turns are history seeding, made explicit by
    `HistoryConfig.initialHistoryInClientContent`: *"**This initial history will not trigger a model call** and
    may end with role MODEL"* ([Gemini Live API reference](https://ai.google.dev/api/live)). So the answer to
    "can any shipping realtime vendor be told to speak an exact string" is currently **no, for both of them**.

28. **The audio model's input transcription runs on a *different, smaller* model.**
    `REALTIME_V2_INPUT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"` (`methods_v2.rs:37`, wired at `:98`).
    Worth noting against #214's finding that 54–57% of omni-model tool failures are argument-value errors: the
    text the router receives has already passed through a mini ASR, which is precisely where identifiers get
    mangled.

29. **GPT-Live is not available in any API.** *"We're bringing GPT-Live-1 and GPT-Live-1 mini to the API soon.
    Developers and enterprises can sign up to be notified using this form"*
    ([@OpenAIDevs](https://x.com/OpenAIDevs/status/2074915334377844896),
    [waitlist](https://openai.com/form/gpt-live-1-in-the-api/)). Nor is the alpha `/v1/live` surface documented
    anywhere: an org-scoped code search for `codexResponseHandoffMode`, `delegation.created`, `quicksilver`,
    `gpt-live-1-boulder-alpha`, `FramelessBidi`, and `v1/live` returns hits **only in `openai/codex`** (plus
    third-party forks and reimplementations), and none of those terms appear in the API changelog. The only
    OpenAI-authored prose about any of it is `codex-rs/app-server/README.md`, which documents the *client* knobs
    and never the wire protocol, the header, or the model id.

---

## Q1 — Who authors the worker brief?

**Answer: not the audio model. It is contractually a pass-through; the delegated text agent authors the brief.**

The chain is unambiguous in source and consistent across both wire versions:

- **Public Realtime API (V2).** The audio model's only route out is `background_agent({prompt})`, whose
  description forbids rewriting (finding 2).
- **Alpha `/v1/live` (V3).** There is no tool at all (finding 4). The `delegation.created` item's content is
  parsed into a field literally named `input_transcript` (finding 3).
- **The fan-out to worker chats happens one hop further in**, on the Responses API, via `spawn_agent`, whose
  `message` parameter is the brief and whose usage guidance requires the *text* agent to plan first
  (finding 23).

This resolves the ambiguity #216 left open. The precise written brief observed there — absolute path,
read-only constraint, split into two tasks, reporting clause — cannot have been authored by the audio model,
because the audio model is prohibited from rephrasing and has no tool that can address a worker. It was
authored by the delegated text model. **#212's resolution that "the router authors the brief" is confirmed,
and confirmed more strongly than it was stated**: at the incumbent it is not merely where the brief happens to
be written, it is the only place it *can* be written.

---

## Q2 — Who condenses the worker's returned markdown into the spoken line?

**Answer: the audio model. This contradicts #212's resolution and, with it, ADR-0007 consequence #4.**

Four independent statements, each from a different source and a different side of the seam:

| Side | Source | What it says |
|---|---|---|
| The audio model, to itself | `backend_prompt.md` §"Presenting backend results" | *"Briefly tell the user the key takeaway… **without repeating visible content**"*; *"Do not read out or recreate tables, diffs, plots, code blocks, structured data"* |
| The text agent, about itself | `realtime_start.md` | *"Any response you produce will be consumed by the intermediary and **may be summarized** before the user sees it"* |
| OpenAI, in the current prompting guide | §"Rephrase Supervisor Tool" | *"the responder **must** rephrase the thinker's text into an audio-friendly response before generating audio"* |
| The wire | `core/src/realtime_conversation.rs:2025-2072` | backend text arrives as a `[BACKEND] `-prefixed **`user`-role** message, then `response.create` generates |

The router does condense — `realtime_start.md` tells it to *"Keep responses concise and action-oriented"* and
its output is hard-truncated at 1,000 tokens (finding 8) — but it condenses **for the intermediary, not for the
ear**. The line the user hears is authored by the audio model, from a summary, from a report.

That is a **three-stage lossy chain**, not the two the map assumes:

```
worker markdown → coordinator's FINAL_ANSWER digest → 1000-token truncation → audio model's spoken takeaway
     (#216's payload)         (finding 24)                  (finding 8)              (findings 6, 16)
```

**What this does to #212.** #212 resolved that the router condenses and — on the strength of a ChatGPT voice
self-report — that the split-by-leg hybrid ships. Leg one (router authors the brief) is confirmed. Leg two
(router authors the spoken line) is **refuted at the incumbent**: OpenAI's router authors a *digest*, and a
second model authors the *utterance*. #212's own caveat that the reshaper "always runs" survives; what does not
survive is the assumption that the reshaper is the last thing to touch the words.

---

## Q3 — Does the realtime model read a tool result verbatim, or re-generate it?

**Answer, decisively, on the public Realtime API: it re-generates. There is no verbatim-read mode on that
surface — not a channel, not a field, not a parameter. The `speakable` channel is alpha-only and OpenAI
documents that it has no effect on the public API.** This was the ticket's highest-value question and it is
answerable.

### The negative result, and what was checked to get it

- **No `speakable` on the public wire.** `RealtimeContextAppendChannel` is only ever serialized onto
  `FramelessBidi`-only messages (finding 12), and one dispatch function makes the contrast explicit: the same
  worker output goes out as a channel-tagged `delegation.context.append` on the alpha and as a plain
  `function_call_output` **with no channel parameter** on the public API (finding 11). The mode selector that
  drives the channel is documented *"This setting has no effect on V1 or V2"* (`app-server/README.md:997`),
  and V2 is *"the Realtime Voice API"* — the public one (`app-server/README.md:178`).
- **No verbatim affordance anywhere in the public API surface.** A sweep of the complete client-events
  reference and of all of `openai-python/src/openai/types/realtime/` and `openai-node/src/resources/realtime/`
  for `verbatim`, `speakable`, `say exactly`, `read aloud`, `speak this`, `text_to_speech`, `"channel"`,
  `commentary`, `final_answer`, `phase` returns **zero hits**. The one `channel`-named field on the public
  surface is `channels?: number`, an audio channel count
  (`openai-node/src/resources/realtime/realtime.ts:3852`). Same sweep over both Agents SDKs' realtime packages
  and docs trees: zero (finding 22).
- **The one true-looking hit is a false friend.** `gpt-realtime-2` *does* expose `commentary | final` and
  `response.done.phase` on the public API — but it classifies **the model's own generated output**, not an
  input channel for a string we want spoken (finding 20).
- **The documented behaviour is generation** (finding 14), and the documented failure mode of asking for
  verbatim is *"paraphrasing, truncation, or blending in its own preamble"* (finding 15).
- **OpenAI's own guide tells the responder to rephrase** the supervisor's text, in the only responder-thinker
  section it has (finding 16).
- **The reference repo proves the absence by contrast** — it achieves verbatim readout by shouting in prompt
  strings, and paraphrases anyway in its own first example (finding 21). If a channel or flag existed, the
  flagship sample would use it.
- **And the shipped client no longer even tries.** On V2 it does not route answer text through the tool return
  at all — the tool returns *"Background agent finished. Use the preceding [BACKEND] messages as the result"*
  and the content arrives as `user`-role conversation items (findings 9, 10). The word "verbatim" is absent
  from its entire realtime path (finding 13).

### What *is* reachable on the public API, in descending order of control

1. **Synthesize the span yourself** with a separate TTS call and play it on your own audio path, bypassing the
   realtime model. The only deterministic option — and it costs the natural voice, which is the entire reason
   ADR-0007's amendment chose a hosted audio leg.
2. **`response.create` with `input: []` and `instructions: "Say exactly the following: …"`** — documented under
   "Create responses with no context"
   ([realtime-conversations](https://developers.openai.com/api/docs/guides/realtime-conversations.md)), but
   `instructions` is typed *"not guaranteed to be followed by the model"* (finding 19). And clearing context is
   not free in a live conversation: the utterance is generated against an empty history.
3. **The `require_repeat_verbatim` JSON-envelope convention** (finding 17) — a prompting trick with no published
   pass rate, no eval, and soft language throughout.

None of these is enforcement. All three are outside the seam #199 rule 7 currently guards.

### Consequence — #221's fear is confirmed, and it is worse than stated

ADR-0007 consequence #4 says the shipped default (`Thinking`) *"sends no channel and lets the audio model
decide."* That is true but understates it. On the public API **there is no channel to send at all**, so
"default" is the wrong frame — it is the only mode. And the audio model is not merely *permitted* to
re-author: at the incumbent it is under a standing instruction not to repeat (finding 6), and OpenAI's guide
tells you to prompt for exactly that rephrasing (finding 16). The permissive reading and the mandated reading
have very different failure rates.

**So #199's rule 7 is enforced on the wrong side of the seam.** Argo checks a sentence; a different model,
which we do not currently prompt, speaks a different sentence, generated from a truncation of ours. Every
protected-marker guarantee in #199 / #203 / #207 terminates at that hop.

This does **not** collapse #207 — the reshaper still runs and still has to produce a faithful input, and a
guard on a faithful input is strictly better than none. What it collapses is the claim that the guard is a
*guarantee*. #207's premise survives; its **enforcement model** must be restated as best-effort-plus-instruction
rather than as a check. The one real lever the public API gives us is `session.instructions` — we author the
audio model's system prompt, and OpenAI's own is ~900 words doing precisely this kind of shaping, with a
published recipe for the reshaping step (finding 16). That is where a fidelity contract has to live for v1, not
only on the string we hand over.

---

## Q4 — Could GPT Live drive Claude Code sessions directly, with no router?

**Answer: no — and the reasons that break it are structural, not preferences. But the router that survives is a
coordinator and a state-holder, not the condenser the map draws.**

### What breaks

1. **Sessions are not addressable by a stateless tool caller.** Driving a session means: start it, keep its id,
   stream its output, decide when it is done, steer it mid-flight, and know which of three concurrent sessions
   a follow-up refers to. That is state across turns. OpenAI's audio model holds none of it — it gets a
   `[BACKEND] `-prefixed feed truncated to 1,000 tokens (finding 8) and a completion ack that says *"use the
   preceding messages"* (finding 10). The state lives in the text agent's thread. Direct drive would put it in
   the audio model's context window, in the most expensive token representation there is (#214: audio in at
   6.4× frontier text in, ~19× per unit of conversational content).
2. **The fan-out primitive does not exist on the audio side.** `spawn_agent` is a Responses API namespace tool
   (finding 23). Nothing equivalent exists in a realtime session's tool surface, and OpenAI did not put one
   there — with the whole stack to design, they gave the audio model two functions (finding 1).
3. **Argument capture from audio is the dominant tool-calling defect, and Argo's arguments are the worst case.**
   #214's converging measurements put 54–57% of omni-model tool failures at argument-value errors. Argo's tool
   arguments are file paths, branch names, function names, issue numbers. Direct drive removes the one
   intermediary that currently turns a transcript into a checked brief — and the transcript itself has already
   been through a mini ASR (finding 28).
4. **Latency, unchanged and unanswerable.** #214: 62–159× between realtime TTFA and max-effort frontier
   reasoning, widening from both ends. Direct drive means the audio model holds the turn while a coding session
   runs. The fire-and-forget rule stays load-bearing whatever else changes. ⚠️ And note the **Python SDK cannot
   even express fire-and-forget**: every function-tool return hard-codes `start_response=True`, so the audio
   model speaks on every return (finding 22). If Argo's harness is Python, that is a concrete constraint, not a
   preference.
5. **The condensation the map needs still has to happen somewhere.** Even with no router, *something* must turn
   a coding session's markdown into a spoken line. Direct drive does not delete that step, it relocates it into
   the audio model — the model we cannot instrument, cannot measure per-turn, and whose knowledge cutoff is
   2024-09-30. That is strictly worse than doing it in a model we control.
6. **And the option is not purchasable today.** GPT Live has no API (finding 29). "Direct drive by GPT Live" is
   not a v1 alternative under evaluation; it is a hypothetical about a model on a waitlist.

### What survives of #214's Argo-specific reasons, weighed on their merits

| #214's reason | Verdict from this pass |
|---|---|
| **Claude is the subscription** | **Survives, structurally.** Nothing here touches it. It is not a comparative claim and no finding can refute it. |
| **Claude holds the session context** | **Survives, and is now the strongest reason.** Findings 8, 10, 23, 24 show the incumbent putting exactly this job on the text side, with the audio model deliberately starved to a 1,000-token feed. |
| **Read-only containment** | **Survives, and gains a third independent confirmation.** Finding 25: OpenAI *prohibits* the audio model from acting as a policy gate, and the system card grounds it in the audio models lacking independent tool access. |
| **Knowledge staleness** | **Survives, and is sharpened.** It is not only that the audio model's knowledge is stale — it is that the audio model is the one authoring the spoken line (Q2), so staleness lands directly in the output. |
| **Latency** (#214's first reason) | **Survives unchanged**, and gains a harness-level constraint in the Python SDK (finding 22). |

### The honest correction

The user's instinct — that the router might be redundant — is **wrong about coordination and right about
something adjacent**. The router is not redundant as a coordinator; the incumbent's architecture is a
point-for-point argument for keeping it, and #214's five Argo-specific reasons all survive contact with source.
But the map draws the router as *both* coordinator *and* condenser, and the incumbent puts the condenser on the
far side of the seam. So one of the router's two drawn jobs is real and load-bearing, and the other is one the
audio model will do **again anyway, whether or not we do it first**. That is the finding that should propagate,
not a redundancy verdict.

---

## The incumbent self-report — recorded as its own evidence class

**Evidence class: model self-report.** A ChatGPT voice chat, asked about its own architecture (2026-07-26,
relayed onto #221). It is a plausible narrative generated by a model, not a config read. #210's correction
happened precisely because described behaviour was wrong and source was right. Recorded here for the record and
scored against source below.

> *"I handle the summarizing. GPT Live runs the conversation and presents it, and it might rephrase my wording.
> The router isn't just for summarizing, though. It keeps the task state, scopes the brief, and enforces
> policies before the summary goes to GPT Live."*

| Claim | Source verdict | Evidence |
|---|---|---|
| *"I handle the summarizing"* | **Half right, and the wrong half is load-bearing.** Both sides summarize. The router digests *for the intermediary*; the **audio model authors the spoken line** and is instructed not to repeat the router's words. | Findings 6, 7, 8, 16 |
| *"it might rephrase my wording"* | **Understated.** Not "might" — the audio model's system prompt *mandates* not repeating visible content and forbids reading out structured output, and OpenAI's guide says the responder *must* rephrase. | Findings 6, 16 |
| *"keeps the task state"* | **Confirmed**, and it is the router's strongest surviving job. | Findings 8, 10, 23, 24 |
| *"scopes the brief"* | **Confirmed, and stronger than claimed.** The audio model is not merely declining to author the brief; it is prohibited from rephrasing at all. | Findings 2, 3, 23 |
| *"enforces policies"* | **Confirmed as a router job, misplaced on the leg.** Source puts the judgement on the **inbound** request (*"the backend makes the final judgement on whether it is doable, or whether it is safe"*), not on the return summary. The audio model is explicitly told *not* to block or filter. | Finding 25 |
| *"before the summary goes to GPT Live"* | **Refuted as a description of the return leg.** No policy gate sits between the router's summary and the audio model — the summary is truncated (finding 8) and injected as a user-role message (finding 9), and nothing inspects it. | Findings 8, 9, 25 |

**Where source and self-report disagree, source wins.** The net effect of the disagreement is that the
self-report is *too reassuring*: it presents the last hop as an optional rephrase, and the source shows it as a
mandated re-authoring. The #221 comment's own reading — that *"it might rephrase my wording"* is the affirmative
case for the risk — is correct, and the source makes the case more strongly than the self-report did.

---

## What we could not establish

- **Whether ChatGPT's consumer voice product uses the same prompts as the Codex desktop client.** Everything
  above is read from `openai/codex`, the shipped client of the delegation path. The consumer ChatGPT app is a
  different frontend against the same alpha surface, and its system prompts are not published. The #216
  observation (project chats, precise briefs, workers outliving the voice session) is consistent with the Codex
  architecture at every point, but consistency is not identity. Treat the prompt quotes as *"OpenAI's shipped
  voice-delegation client"*, not as *"ChatGPT."*
- **Who composes the spoken response, from any *OpenAI-authored statement*.** The system card, the ChatGPT
  Voice product page, and the codex README all decline to say it. The system card never even names the
  delegated-to model — *"our other models"*, *"our highly capable flagship models"* — and mentions GPT-5.5 only
  once, as a capability comparator, not as the delegation target. The ChatGPT Voice page attributes everything
  to an undifferentiated *"ChatGPT Voice"*. Q2's answer rests on prompts and wire behaviour, which is stronger
  evidence, but the *prose* gap is real and should be stated as such.
- **Whether `require_repeat_verbatim` has any privileged server-side or training-time recognition.** The guide's
  framing (*"looks more in-distribution"*, *"machine-clear"*) implies a learned-prior effect with no
  special-casing, but OpenAI never states this either way.
- **Any quantitative reliability figure for verbatim readout under instruction.** No published pass rate, eval,
  or error bound for the JSON-envelope technique, for `instructions: "Say exactly…"`, or for the
  Chat-Supervisor "read verbatim" prompt. #203's 15.7–21.3% marker-drop rate remains the only number we have,
  and it measures our reshaper, not this hop.
- **The API default for `reasoning.effort`.** The migration guide says *"Set reasoning effort to `low` instead
  of the default"* but never names the default. ⚠️ #214 asserted *"production default is `low`"*; that is what
  OpenAI **recommends**, not the default. Minor, but it is a factual claim on a closed ticket.
- **`gpt-realtime-2.1`-specific verbatim behaviour.** The prompting guide splits `gpt-realtime-2` vs "Realtime
  1.5"; no `2.1`-specific statement on tool-result realization was found.
- **Whether `delegation.created` carries fields beyond what codex parses.** The client reads `id`, `type`,
  `target`, and `content`; the server's full event schema is unobservable from the client.
- **The rate at which the audio model's re-authoring actually drops a protected marker.** This is now the sharp
  empirical question and it is measurable: hand the public Realtime API a corpus of #203-class payloads via a
  function tool and score the spoken transcript against the input. Nothing in this pass substitutes for that
  measurement.
- **Whether `session.instructions` shaping materially reduces that rate.** It is the only real lever the public
  API offers and its effectiveness is unmeasured.

---

## What this changes on map #190

**Flagged, not amended — these belong to their own tickets.**

1. **ADR-0007 consequence #4 needs a second correction.** It currently reads that we inherit a `Thinking`
   default which *"sends no channel and lets the audio model decide"*, concluding the inherited default points
   at Argo's status quo. Two errors: (a) on the public API there is no channel to send at all, so the "default"
   framing is misleading — it is the only mode; (b) the incumbent's audio model is *instructed not to repeat*,
   which is materially stronger than "decides." The conclusion that reshaping in the concierge matches the
   incumbent still holds; the reason it holds is different, and the residual risk is larger than recorded.
2. **ADR-0007's amendment names the wrong model.** It says v1 uses *"OpenAI's Realtime API (GPT Live)"*. Those
   are two different things: GPT Live has no API (finding 29), and the public Realtime API serves
   `gpt-realtime-*`. The decision is unaffected; the naming should be corrected before it propagates further,
   because #210's and #214's evidence about *GPT-Live-1 the product* does not automatically transfer to
   *`gpt-realtime-2.1` the API model*, and this pass has been conflating them at the map's invitation.
3. **#212's resolution is half-refuted.** The input leg (router authors the brief) is confirmed and
   strengthened. The output leg (router authors the spoken line) is refuted at the incumbent — their router
   authors a digest and the audio model authors the utterance. #212's hybrid stands as *Argo's choice*; it can
   no longer be described as what the incumbent does.
4. **#199 rule 7 / #203 / #207 need their enforcement model restated.** They are best-effort inputs to a hop we
   do not control, not guarantees. #207 is not collapsed — its premise survives — but "enforcement" is the
   wrong word for what happens at the seam, and the spec should say so.
5. **A new lever, unclaimed by any ticket: `session.instructions`.** We author the audio model's system prompt.
   OpenAI's is ~900 words and does most of the fidelity work in this architecture, and their guide ships a
   named recipe for the reshaping step (finding 16). Argo has no ticket for it. That is the gap this pass opens,
   and it is the only place a fidelity contract can bind on the leg that actually speaks.
6. **#194's scheduling vocabulary gains data points on both sides.** OpenAI ships `remain_silent` — the
   `SILENT` third of Gemini's triple — as a no-op tool rather than a field; Gemini has full semantics for all
   three but has **dropped** them on its newest model (finding 26). #210's recommendation to adopt the three-way
   vocabulary stands, but "the industry is converging on this" would now be an overstatement.
