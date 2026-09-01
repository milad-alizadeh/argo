@testable import ArgoEngine
import Foundation
import Testing

/// What happens to dials that arrive faster than the main queue accepts them (#785).
///
/// The gate's socket is served by a `DispatchSource` on the main queue, so nothing is accepted
/// while a `@MainActor` caller holds it. Every dial below therefore lands in the kernel's queue
/// unaccepted, which is exactly the burst a Turn raising several tool calls at once produces —
/// each one runs a hook, and each hook dials.
///
/// An `AF_UNIX` dial has no handshake to retry: past the queue's depth the kernel refuses it
/// outright, the hook reads that as Argo being unreachable, and it DENIES the call it was asking
/// about. So the depth is a correctness property of the gate, not a tuning knob.
@Suite("Companion socket backlog")
@MainActor
struct CompanionBacklogTests {
    /// More than the depth this socket used to have, and more than one Turn plausibly raises.
    private static let burst = 16

    @Test
    func `a burst of dials is all queued rather than refused`() throws {
        let socketPath = Self.temporaryPath()
        let socket = CompanionSocket(path: socketPath) { _ in nil }
        try socket.open()
        defer { socket.close() }

        // Synchronous on the main actor throughout, so the accept handler cannot run between them.
        var dialled: [CompanionClient] = []
        defer { dialled.forEach { $0.close() } }
        for _ in 0 ..< Self.burst {
            guard let client = CompanionClient.dialledOnce(socketPath) else { break }
            dialled.append(client)
        }

        #expect(dialled.count == Self.burst)
    }

    /// The other half of the same fix: a queue that is drained one dial per turn still grows under
    /// a burst. Every line below is answered, which can only happen if one turn accepted them all.
    @Test
    func `every dial in a burst is answered, not just the first`() async throws {
        let socketPath = Self.temporaryPath()
        // A JSON reply because that is what the client parses; a bare string reads as no answer.
        let socket = CompanionSocket(path: socketPath) { _ in #"{"heard":true}"# }
        try socket.open()
        defer { socket.close() }

        var dialled: [CompanionClient] = []
        defer { dialled.forEach { $0.close() } }
        for index in 0 ..< Self.burst {
            let client = try #require(CompanionClient.dialledOnce(socketPath))
            client.sendLine("call-\(index)")
            dialled.append(client)
        }

        // Accumulated rather than recounted: `receive` consumes the line, so a fresh count each
        // poll would forget every answer that arrived on an earlier one.
        var heard = [Bool](repeating: false, count: dialled.count)
        _ = await settle {
            for (index, client) in dialled.enumerated() where !heard[index] {
                heard[index] = client.receive() != nil
            }
            return heard.allSatisfy(\.self)
        }

        #expect(heard.count { $0 } == Self.burst)
    }

    /// Short, because `sun_path` is 103 bytes and a temp directory plus a UUID spends them.
    private static func temporaryPath() -> String {
        "/tmp/argo-backlog-\(UUID().uuidString.prefix(8)).sock"
    }
}
