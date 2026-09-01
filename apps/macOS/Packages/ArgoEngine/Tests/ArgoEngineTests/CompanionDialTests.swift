@testable import ArgoEngine
import Foundation
import Testing

/// What a test's own dial into a companion socket may assume about the listener (#915).
@Suite("Companion dial")
@MainActor
struct CompanionDialTests {
    @Test
    func `a dial waits for a listener that opens on a later turn`() async throws {
        let path = Self.temporaryPath()
        let socket = CompanionSocket(path: path) { _ in #"{"heard":true}"# }
        defer { socket.close() }

        // A listener is opened on the main actor, which every suite here shares, so nothing is
        // listening until the turn below runs — which is the race a single attempt lost.
        #expect(CompanionClient.dialledOnce(path) == nil)
        Task { @MainActor in try? socket.open() }

        let client = try await CompanionClient.dialled(path)
        defer { client.close() }
        client.sendLine("call")
        var heard = false
        _ = await settle {
            heard = heard || client.receive() != nil
            return heard
        }

        #expect(heard)
    }

    @Test
    func `a dial no listener answers carries the errno of the call that refused it`() async throws {
        let path = Self.temporaryPath()

        let refused = try await Self.refusal(dialling: path, within: .milliseconds(50))

        #expect(refused.refusal == ENOENT)
        #expect(!refused.isSocketFilePresent)
        #expect(refused.pathBytes == path.utf8.count)
    }

    /// The mode the ticket's own body was about. It carries no errno — nothing was dialled — and a
    /// reading taken after the fact would name whichever call ran last.
    @Test
    func `a path over sun_path is refused on the first attempt, naming its length`() async throws {
        let path = "/tmp/\(String(repeating: "a", count: unixSocketPathLimit)).sock"
        let started = ContinuousClock.now

        // The FULL guard, deliberately: a length checked inside the retry loop would spend all of
        // it re-asking a question whose answer cannot change.
        let refused = try await Self.refusal(dialling: path, within: settleLimit)

        #expect(refused.refusal == nil)
        #expect(refused.pathBytes > unixSocketPathLimit)
        #expect(ContinuousClock.now - started < .seconds(1))
    }

    private static func refusal(
        dialling path: String,
        within bound: Duration,
    ) async throws
        -> CompanionClient.DialFailure {
        var refused: CompanionClient.DialFailure?
        do {
            _ = try await CompanionClient.dialled(path, within: bound)
        } catch let failure as CompanionClient.DialFailure {
            refused = failure
        }
        return try #require(refused)
    }

    /// Short, because `sun_path` is 103 bytes and a temp directory plus a UUID spends them.
    private static func temporaryPath() -> String {
        "/tmp/argo-dial-\(UUID().uuidString.prefix(8)).sock"
    }
}
