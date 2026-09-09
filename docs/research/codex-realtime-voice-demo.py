#!/usr/bin/env python3
"""Talk to Codex realtime over the app-server JSON-RPC socket, on the ChatGPT sign-in.

Evidence for docs/research/2026-09-09-codex-realtime-voice-on-the-subscription.md.
No OPENAI_API_KEY is read or sent. The WebRTC transport authenticates with the
Codex session, which is the whole point of the demo.

  python3 -m venv venv && venv/bin/pip install aiortc sounddevice numpy
  venv/bin/python codex-realtime-voice-demo.py                  # live mic and speaker
  venv/bin/python codex-realtime-voice-demo.py --mic-test       # microphone only
  venv/bin/python codex-realtime-voice-demo.py --silent \
      --say "Count from one to five."                           # no mic needed
"""
import argparse, asyncio, fractions, json, sys, time

import numpy as np
import sounddevice as sd
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import MediaStreamError, MediaStreamTrack
from av import AudioFrame

RATE = 48000
SAMPLES = 960  # 20 ms


class MicTrack(MediaStreamTrack):
    """Microphone as an outgoing WebRTC audio track."""

    kind = "audio"

    def __init__(self, silent=False):
        super().__init__()
        self.silent = silent
        self.pts = 0
        self.queue = asyncio.Queue(maxsize=50)
        self.level = 0.0  # peak of the most recent block, 0..1
        self.loop = asyncio.get_event_loop()
        if not silent:
            self.stream = sd.InputStream(
                samplerate=RATE, channels=1, dtype="int16",
                blocksize=SAMPLES, callback=self._on_audio)
            self.stream.start()

    def _push(self, block):
        # the queue only fills before ICE connects, when nothing is draining it.
        # drop the oldest block rather than let put_nowait raise into the loop.
        if self.queue.full():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            self.queue.put_nowait(block)
        except asyncio.QueueFull:
            pass

    def _on_audio(self, indata, frames, t, status):
        self.level = float(np.abs(indata).max()) / 32768.0
        try:
            self.loop.call_soon_threadsafe(self._push, indata.copy())
        except RuntimeError:
            pass

    async def recv(self):
        if self.silent:
            await asyncio.sleep(SAMPLES / RATE)
            data = np.zeros((SAMPLES, 1), dtype=np.int16)
        else:
            data = await self.queue.get()
        frame = AudioFrame.from_ndarray(data.reshape(1, -1), format="s16", layout="mono")
        frame.sample_rate = RATE
        frame.pts = self.pts
        frame.time_base = fractions.Fraction(1, RATE)
        self.pts += data.shape[0]
        return frame


RX = {"frames": 0, "peak": 0.0, "loud": 0}  # what actually arrived from the server


async def play(track, silent):
    """Play the assistant's audio, and count what arrives either way."""
    out = sd.OutputStream(samplerate=RATE, channels=1, dtype="int16",
                          blocksize=SAMPLES)
    out.start()
    try:
        while True:
            frame = await track.recv()
            # a stereo frame arrives interleaved; reshaping it to one column plays
            # every sample twice, which is half speed and an octave down.
            ch = len(frame.layout.channels)
            pcm = frame.to_ndarray().astype(np.int16).reshape(-1, ch)
            if ch > 1:
                pcm = pcm.mean(axis=1).astype(np.int16).reshape(-1, 1)
            peak = float(np.abs(pcm).max()) / 32768.0
            RX["frames"] += 1
            RX["peak"] = max(RX["peak"], peak)
            if peak > 0.01:
                RX["loud"] += 1
            if frame.sample_rate != RATE:  # repeat-resample, good enough for a demo
                pcm = np.repeat(pcm, RATE // frame.sample_rate, axis=0)
            out.write(pcm)
    except MediaStreamError:
        return
    finally:
        out.stop()


class AppServer:
    """codex app-server over stdio JSON-RPC."""

    def __init__(self, proc):
        self.proc = proc
        self.next_id = 0
        self.pending = {}
        self.notifications = asyncio.Queue()

    async def reader(self):
        while True:
            line = await self.proc.stdout.readline()
            if not line:
                return
            try:
                msg = json.loads(line)
            except ValueError:
                continue
            if "id" in msg and ("result" in msg or "error" in msg):
                fut = self.pending.pop(msg["id"], None)
                if fut and not fut.done():
                    fut.set_result(msg)
            elif "method" in msg:
                await self.notifications.put(msg)

    def notify(self, method, params):
        self.proc.stdin.write((json.dumps(
            {"jsonrpc": "2.0", "method": method, "params": params}) + "\n").encode())

    async def call(self, method, params):
        self.next_id += 1
        rid = self.next_id
        fut = asyncio.get_event_loop().create_future()
        self.pending[rid] = fut
        self.proc.stdin.write((json.dumps(
            {"jsonrpc": "2.0", "id": rid, "method": method, "params": params}) + "\n").encode())
        msg = await asyncio.wait_for(fut, timeout=30)
        if "error" in msg:
            raise RuntimeError(f"{method}: {msg['error'].get('message')}")
        return msg["result"]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--silent", action="store_true",
                    help="send silence instead of the microphone")
    ap.add_argument("--seconds", type=float, default=25.0)
    ap.add_argument("--debug-sdp", action="store_true")
    ap.add_argument("--all-events", action="store_true")
    ap.add_argument("--say", default=None,
                    help="send this text through appendSpeech once connected")
    ap.add_argument("--voice", default="cove")
    ap.add_argument("--model", default="gpt-live-1-codex")
    ap.add_argument("--mic-gate", action="store_true",
                    help="listen for 2s and refuse if the microphone is dead")
    ap.add_argument("--mic-test", action="store_true",
                    help="record 5s and print the level; no network, no Codex")
    args = ap.parse_args()

    if args.mic_gate:
        # ask, then listen -- a gate that listens in silence always fails.
        print("Say something so I can check the microphone ...")
        peak = 0.0
        with sd.InputStream(samplerate=RATE, channels=1, dtype="int16") as st:
            for _ in range(6):
                block, _ = st.read(RATE // 2)
                peak = max(peak, float(np.abs(block).max()) / 32768.0)
                if peak > 0.02:
                    print(f"microphone ok (peak {peak:.3f})")
                    return
        print(f"I heard almost nothing (peak {peak:.3f}). Starting anyway --"
              " the live meter will show whether your voice is getting through.")
        print("If it stays near zero, raise the input volume in"
              " System Settings > Sound > Input.")
        return

    if args.mic_test:
        print("default input:", sd.query_devices(kind="input")["name"])
        print("recording 5s -- say something")
        peak = 0.0
        with sd.InputStream(samplerate=RATE, channels=1, dtype="int16") as st:
            for i in range(5):
                block, _ = st.read(RATE)
                p = float(np.abs(block).max()) / 32768.0
                peak = max(peak, p)
                print(f"  {i+1}s  peak {p:.3f}  {'#' * int(p * 40)}")
        print("peak", f"{peak:.3f}",
              "-- MICROPHONE IS DEAD (permission?)" if peak < 0.01 else "-- microphone works")
        return

    proc = await asyncio.create_subprocess_exec(
        "codex",
        "-c", "features.realtime_conversation=true",
        "-c", "suppress_unstable_features_warning=true",
        "app-server",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL, cwd="/private/tmp")
    app = AppServer(proc)
    asyncio.ensure_future(app.reader())

    await app.call("initialize", {
        "clientInfo": {"name": "argo-voice-demo", "title": "Argo voice demo", "version": "0.1.0"},
        "capabilities": {"experimentalApi": True}})
    app.notify("initialized", {})
    await asyncio.sleep(0.5)

    auth = await app.call("getAuthStatus", {"includeToken": False})
    print(f"auth method: {auth.get('authMethod')}   (no API key is sent on this transport)")

    thread = await app.call("thread/start", {"cwd": "/private/tmp"})
    tid = thread["thread"]["id"]
    print(f"thread: {tid}")

    pc = RTCPeerConnection()
    mic = MicTrack(silent=args.silent)
    pc.addTrack(mic)  # one sendrecv audio m-line

    played = asyncio.Event()
    connected = asyncio.Event()

    @pc.on("track")
    def on_track(track):
        print(f"<- remote {track.kind} track")
        played.set()
        asyncio.ensure_future(play(track, args.silent))

    t0 = time.monotonic()

    @pc.on("connectionstatechange")
    async def on_state():
        print(f"[{time.monotonic()-t0:5.1f}s] connection: {pc.connectionState}")
        if pc.connectionState == "connected":
            connected.set()

    @pc.on("iceconnectionstatechange")
    async def on_ice():
        print(f"[{time.monotonic()-t0:5.1f}s] ice: {pc.iceConnectionState}")

    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    sdp_answer = asyncio.get_event_loop().create_future()
    started = asyncio.get_event_loop().create_future()

    async def pump():
        while True:
            msg = await app.notifications.get()
            m, p = msg.get("method"), msg.get("params", {})
            if args.all_events and "realtime" in (m or "").lower():
                print(f"   [event] {m} {json.dumps(p)[:220]}")
            if m == "thread/realtime/sdp" and not sdp_answer.done():
                sdp_answer.set_result(p["sdp"])
            elif m == "thread/realtime/started" and not started.done():
                started.set_result(p)
            elif m == "thread/realtime/error":
                print(f"\n!! realtime error: {p.get('message')}")
            elif m == "thread/realtime/transcript/delta":
                sys.stdout.write(f"\r{p.get('role','?')}: {p.get('delta','')}")
                sys.stdout.flush()
            elif m == "thread/realtime/transcript/done":
                print(f"\n{p.get('role','?')}: {p.get('text','')}")
            elif m == "thread/realtime/closed":
                print(f"\nclosed: {p.get('reason')}")
            elif (m or "").startswith("thread/realtime/"):
                print(f"   [event] {m} {json.dumps(p)[:200]}")

    asyncio.ensure_future(pump())

    print("starting realtime session ...")
    await app.call("thread/realtime/start", {
        "threadId": tid,
        "outputModality": "audio",
        "version": "v3",
        "model": args.model,
        "voice": args.voice,
        "transport": {"type": "webrtc", "sdp": pc.localDescription.sdp},
    })

    answer = await asyncio.wait_for(sdp_answer, timeout=30)
    if args.debug_sdp:
        print("--- answer candidates / media ---")
        for l in answer.splitlines():
            if l.startswith(("m=", "a=candidate", "a=setup", "a=ice-", "c=")):
                print("   " + l)
        print("--- end ---")
    await pc.setRemoteDescription(RTCSessionDescription(sdp=answer, type="answer"))
    info = await asyncio.wait_for(started, timeout=30)
    print(f"session accepted: version={info.get('version')} id={info.get('realtimeSessionId')}")
    # the media path is only live once ICE finishes, so the window starts there,
    # not at the moment the session is accepted.
    try:
        await asyncio.wait_for(connected.wait(), timeout=30)
    except asyncio.TimeoutError:
        print("!! the peer connection never reached 'connected'")

    async def meter():
        """One line a second, so a dead microphone is visible rather than guessed."""
        while True:
            await asyncio.sleep(1)
            lvl = getattr(mic, "level", 0.0)
            bar = "#" * int(lvl * 40)
            sys.stdout.write(f"\r  mic {lvl:.3f} |{bar:<40}|")
            sys.stdout.flush()

    if not args.silent:
        print(f"\n--- speak now, {args.seconds:.0f}s ---\n")
        meter_task = asyncio.ensure_future(meter())
    else:
        meter_task = None

    if args.say:
        await asyncio.sleep(2)
        print(f"-> appendSpeech: {args.say!r}")
        await app.call("thread/realtime/appendSpeech", {"threadId": tid, "text": args.say})
    await asyncio.sleep(args.seconds)
    print(f"\nreceived from server: {RX['frames']} frames, "
          f"{RX['loud']} with audio in them, peak {RX['peak']:.3f}")
    if meter_task:
        meter_task.cancel()
        print()

    await app.call("thread/realtime/stop", {"threadId": tid})
    await pc.close()
    proc.terminate()
    print("\ndone")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
