import Foundation

/// One `codex app-server` process, as the drive port needs it: a handshake, a thread to put Turns
/// to, and whichever Turn is in flight (ADR-0024, #548).
///
/// It owns no process and no pipe. Bytes are handed in by whoever is draining the server's stdout
/// and lines go out through `write`, which is the same seam the `claude` adapter's keystrokes take
/// — so a test drives this against a fake without a CLI on the machine.
///
/// **A Turn sent before the thread exists is queued, not refused.** The handshake is three messages
/// deep and answers when the server answers, while the composer is live from the moment the Session
/// appears; refusing there would report Argo's own startup as the user's mistake.
@MainActor
final class CodexThread {
    /// Where the handshake has got to. The id is the server's own for the thread, which every
    /// `turn/start` names.
    enum Stage: Equatable {
        case handshaking
        case ready(String)
    }

    let cwd: String
    private let write: @MainActor (String) -> Bool
    private(set) var stance: CodexStance
    private(set) var stage = Stage.handshaking
    private var lines = CodexLineBuffer()
    private var issued = 0
    private(set) var initializeID: Int?
    private(set) var threadStartID: Int?
    /// The Turn the server is running, taken from `turn/started` and given up at `turn/completed`.
    /// `turn/interrupt` names it, so an interrupt with none is an interrupt with nothing to stop.
    private(set) var turnID: String?
    /// Turns typed before the thread was ready, in the order they were typed.
    private var queued: [String] = []
    /// Images the next Turn carries as input items of their own, rather than as paths for the agent
    /// to open. This is where Codex's attachment fidelity differs from Claude's (ADR-0024): the
    /// bytes reach the model with the Turn instead of when a tool goes and reads them.
    private var pendingImages: [URL] = []

    init(cwd: String, mode: SessionMode, write: @escaping @MainActor (String) -> Bool) {
        self.cwd = cwd
        self.stance = CodexStance.of(mode)
        self.write = write
    }

    /// Say hello. Everything else waits on the server's answer to this.
    func begin() {
        initializeID = ask("initialize", [
            "clientInfo": .object([
                "name": .string(CodexClient.name),
                "title": .string(CodexClient.title),
                "version": .string(CodexClient.version),
            ]),
        ])
    }

    /// Put one Turn to the thread, or hold it until there is one. `false` where the line could not
    /// be written at all, which is the adapter's `notDrivable`.
    func send(_ text: String) -> Bool {
        guard case let .ready(threadID) = stage else {
            queued.append(text)
            return true
        }
        return start(text, on: threadID)
    }

    /// Stop the Turn in flight. Silence where there is none: whether a Turn is running is a DERIVED
    /// reading, and refusing on it would report Argo's own lag as something the user did wrong.
    func interrupt() -> Bool {
        guard case let .ready(threadID) = stage, let turnID else { return true }
        return ask("turn/interrupt", [
            "threadId": .string(threadID),
            "turnId": .string(turnID),
        ]) != nil
    }

    /// Carry these images into the next Turn. Held rather than sent, because `attach` names the
    /// files and `send` carries the words: both halves have to arrive as ONE Turn.
    func willSend(images: [URL]) {
        pendingImages += images
    }

    /// The rung the NEXT Turn starts under. On this surface a rung is a property of the turn rather
    /// than of the process, so there is no walk to make and nothing to send until a Turn goes.
    func setMode(_ mode: SessionMode) {
        stance = CodexStance.of(mode)
    }

    /// One chunk of the server's stdout.
    func received(_ chunk: [UInt8]) {
        for line in lines.take(chunk) {
            guard let message = CodexServerMessage(line: line) else { continue }
            apply(message)
        }
    }

    /// Send a request and answer the id it was given, or nothing where it never reached the server.
    func ask(_ method: String, _ params: [String: JSONValue]) -> Int? {
        issued += 1
        guard let line = CodexRPC.request(id: issued, method: method, params: params),
              write(line)
        else { return nil }
        return issued
    }

    func put(_ line: String?) {
        guard let line else { return }
        _ = write(line)
    }

    /// The server said hello back, so the thread can be asked for — on the stance the rung names,
    /// which is what makes the opening rung ride in at the start rather than after the first Turn.
    func openThread() {
        put(CodexRPC.notification("initialized"))
        threadStartID = ask("thread/start", [
            "cwd": .string(cwd),
            "approvalPolicy": .string(stance.approvalPolicy),
            "sandbox": .string(stance.sandbox.rawValue),
        ])
    }

    /// The thread exists: everything typed while it did not goes now, in the order it was typed.
    func opened(_ threadID: String) {
        stage = .ready(threadID)
        let waiting = queued
        queued = []
        for text in waiting {
            _ = start(text, on: threadID)
        }
    }

    func noted(turn: String?) {
        turnID = turn
    }

    private func start(_ text: String, on threadID: String) -> Bool {
        let images = pendingImages
        pendingImages = []
        let sent = ask("turn/start", [
            "threadId": .string(threadID),
            "cwd": .string(cwd),
            "approvalPolicy": .string(stance.approvalPolicy),
            "sandboxPolicy": stance.sandbox.policy,
            "input": .array([.object(["type": .string("text"), "text": .string(text)])]
                + images.map(Self.imageInput)),
        ]) != nil
        // The images go back on the pile when the write failed, for the reason the composer keeps
        // its chips: nothing about the Turn has happened, so nothing about it may be forgotten.
        if !sent {
            pendingImages = images
        }
        return sent
    }

    private static func imageInput(_ url: URL) -> JSONValue {
        .object(["type": .string("localImage"), "path": .string(url.path)])
    }
}
