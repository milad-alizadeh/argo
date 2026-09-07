@testable import ArgoEngine
import Foundation

/// A socket transport that hands back scripted frames — the seam that keeps every suite about the
/// forwarder off the network.
actor ScriptedSockets: WebSocketTransport {
    private let frames: [Data]
    private var opened: ScriptedChannel?
    private var dialled: WebSocketRequest?

    init(frames: [Data] = []) {
        self.frames = frames
    }

    /// What the last dial presented, so a case can claim the handshake carried the token in the
    /// spelling the forwarder takes.
    func lastRequest() -> WebSocketRequest? {
        dialled
    }

    /// Every frame written back down the socket, which is one acknowledgement per delivery.
    func sent() async -> [Data] {
        await opened?.written() ?? []
    }

    func closed() async -> Int {
        await opened?.closeCount() ?? 0
    }

    func open(_ request: WebSocketRequest) async throws -> any WebSocketChannel {
        dialled = request
        let channel = ScriptedChannel(frames: frames)
        opened = channel
        return channel
    }
}

/// One scripted socket: the frames it carries, and then the end of it.
actor ScriptedChannel: WebSocketChannel {
    private var frames: [Data]
    private var sent: [Data] = []
    private var closes = 0

    init(frames: [Data]) {
        self.frames = frames
    }

    func written() -> [Data] {
        sent
    }

    func closeCount() -> Int {
        closes
    }

    func receive() async throws -> Data {
        guard !frames.isEmpty else { throw WebSocketError.unreadableFrame }
        return frames.removeFirst()
    }

    func send(_ frame: Data) {
        sent.append(frame)
    }

    func close() {
        closes += 1
    }
}
