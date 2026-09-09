# Codex realtime voice runs on the ChatGPT sign-in — proved with a live session

**Date:** 2026-09-09 · **For:** [#1779](https://github.com/milad-alizadeh/argo/issues/1779), part of
[#341](https://github.com/milad-alizadeh/argo/issues/341) · **Status:** verified by running code, not by
source-reading

**Question.** [ADR-0007](../adr/0007-voice-concierge-delegated-reasoning.md)'s 2026-07-26 amendment commits
v1 to OpenAI's public Realtime API and states, as consequence #1, that the audio leg is metered at about
$0.02 to $0.05 per active minute. That conflicts with the standing constraint in AGENTS.md that this repo
runs on subscription-included tokens ([ADR-0024](../adr/0024-session-drive-port-two-adapters.md),
[ADR-0031](../adr/0031-the-backlog-question-runs-on-codex-exec.md)). Can the audio leg run on the ChatGPT
sign-in instead?

**Answer. Yes, over WebRTC.** A live two-way voice conversation ran against `codex app-server` on the
ChatGPT sign-in. No API key was present and none was sent. The session reported `authMethod: chatgpt`, ICE
reached `completed`, the connection reached `connected`, the assistant's audio came back over the media
track, and both sides printed as text.

## What the gate actually is

`realtime_api_key()` in `codex-rs/core/src/realtime_conversation.rs` raises *"realtime conversation requires
API key auth"*. It has **one call site**, and that call site is the `Websocket` arm of the transport match:

```rust
let mut extra_headers = match transport {
    ConversationStartTransport::Websocket => {
        let realtime_api_key = realtime_api_key(auth.as_ref(), &provider)?;   // the gate
        realtime_request_headers(..., Some(realtime_api_key.as_str()), ...)?
    }
    ConversationStartTransport::Webrtc { .. } | ConversationStartTransport::ExistingCall { .. } => {
        realtime_request_headers(..., /*api_key*/ None, ...)?
    }
```

The gate is **per transport, not per feature**. `Webrtc` and `ExistingCall` pass no key and authenticate
with the Codex session. The function also carries a TODO that marks the key requirement as temporary.

The gate was added in codex-cli **0.108.0**, by commit `b20b6aa4` (PR #13265, *"Update realtime websocket
API"*, `aibrahim-oai`). It is absent in 0.105.0 through 0.107.0. The commit reads as a transport migration
rather than a cost control, which is the opposite of the reading that a websocket-only test suggests.

## What was proved, and what was not

| Claim | Status |
| --- | --- |
| The WebRTC transport authenticates on the ChatGPT sign-in | **Proved.** `authMethod: chatgpt`, no key in the environment |
| A person can hold a two-way spoken conversation through it | **Proved.** Live microphone in, assistant audio out |
| Transcripts arrive for both sides | **Proved.** `thread/realtime/transcript/delta` and `.../done` |
| `appendSpeech` reads its text out verbatim | **Disproved.** See below |
| The subscription quota it draws on | **Not measured.** Codex issues #37619 and #40792 report voice blocked by Codex usage limits, which is the subscription quota rather than a bill |

## `appendSpeech` is a prompt, not a script

This is the finding [#1779](https://github.com/milad-alizadeh/argo/issues/1779) was filed to settle, and it
falls the way [#221](https://github.com/milad-alizadeh/argo/issues/221) predicted, on a surface that looked
like the exception.

| Sent through `appendSpeech` | Spoken |
| --- | --- |
| `The build is green, but only for the parser tests.` | *"Good news: the build is green for the parser tests."* |
| `The deploy finished, but not the migration.` | *"The deploy is done, but the migration is still pending."* |
| `Please say out loud: the build is green.` | *"The build is green."* |
| `Count from one to five, slowly.` | *"One... two... three... four... five."* |

The first line lost *"but only"* and inverted its meaning, which is the marker loss of
[#199](https://github.com/milad-alizadeh/argo/issues/199) and
[#203](https://github.com/milad-alizadeh/argo/issues/203) on the leg
[#222](https://github.com/milad-alizadeh/argo/issues/222) hoped was verbatim. The last two lines show why:
the text is **obeyed as an instruction**, not read. The model dropped *"Please say out loud"* and did what
it asked.

So the type description *"append speakable text to thread realtime"* describes the route, not the fidelity.
ADR-0007 consequence #4 stands, and the fidelity contract stays in `session.instructions` where
[#222](https://github.com/milad-alizadeh/argo/issues/222) put it. Sample size is 4 lines, in the default
handoff mode, on v3. The three `codexResponseHandoffMode` values are still untested.

## The recipe

`codex app-server` speaks JSON-RPC over stdio. The demo beside this doc,
[`codex-realtime-voice-demo.py`](./codex-realtime-voice-demo.py), is the whole thing in about 260 lines.

1. Start `codex -c features.realtime_conversation=true app-server`.
2. `initialize` with `capabilities: {experimentalApi: true}`, then the `initialized` notification.
3. `thread/start`, and keep the thread id.
4. Build an `RTCPeerConnection` with one outgoing audio track, and create the offer.
5. `thread/realtime/start` with the offer in the transport parameter:

```json
{ "threadId": "...", "outputModality": "audio", "version": "v3",
  "model": "gpt-live-1-codex", "voice": "cove",
  "transport": { "type": "webrtc", "sdp": "<offer>" } }
```

6. Apply the answer that arrives on `thread/realtime/sdp`. Audio then flows on the media track.

## Five traps, each of which cost a wrong conclusion

1. **`transport` is a parameter, not a config key.** Setting `-c realtime.transport=webrtc` changes nothing.
   The code branches on the parameter, so a run that omits it defaults to the websocket arm and hits the
   API-key gate. **This one produced a wrong answer that survived a whole session**: the gate was reported
   as a feature-level requirement when it is transport-level.
2. **v3 uses the v1 voice list.** `marin` is refused. Use `cove`, `juniper`, `maple`, `spruce`, `ember`,
   `vale`, `breeze`, `arbor` or `sol`.
3. **v3 refuses a missing `model` field.** Send `gpt-live-1-codex` (openai/codex#40140, where an OpenAI
   engineer supplies the name).
4. **The notification methods are slash-separated.** `thread/realtime/transcript/delta`, not the camel case
   the generated type names imply. A client that listens for the camel-case name sees a silent session.
5. **One audio m-line only.** Calling `addTrack` and `addTransceiver("audio", ...)` together creates two,
   and ICE then sticks at `checking` forever with no error.

Two more traps live in the demo client rather than the protocol. The handshake takes about 7 seconds, so a
run shorter than that tears down mid-negotiation, and a prompt to speak that prints before `connected`
collects nothing. Audio arrives **stereo**, so reshaping it into one mono column plays every sample twice
and the assistant sounds an octave down.

## What this changes

The audio leg is no longer a metered dependency, which removes ADR-0007's consequence #1 and brings v1 back
inside the constraint the rest of the repo holds. It does not remove consequence #2: audio still leaves the
machine.

The cost moves rather than disappearing. Argo would carry a WebRTC client in Swift, drive the app-server
socket that [ADR-0024](../adr/0024-session-drive-port-two-adapters.md) already uses for Sessions, and depend
on a feature whose own flag reads *under development* and whose key gate carries a *temporary* TODO. Codex
removed its TUI voice deliberately (openai/codex#27801, *"never released or completed. The removal was
intentional"*) while realtime shipped heavily across Desktop, iOS and Android through August and September,
so the surface is moving under us in both directions.
