@testable import ArgoEngine
import Foundation
import Testing

/// What a test's own dial into a companion socket may assume about the listener (#915).
///
/// A listener is opened ON THE MAIN ACTOR, and every suite here shares that actor. So a dial made
/// before the turn that opens it is refused — and the refusal a one-shot dial reported was a bare
/// `→ nil`, which named neither a cause nor which of the two it was.
@Suite("Companion dial")
@MainActor
struct CompanionDialTests {
    @Test
    func `a dial waits for a listener that opens on a later turn`() async throws {
        let path = Self.temporaryPath()
        let socket = CompanionSocket(path: path) { _ in #"{"heard":true}"# }
        defer { socket.close() }

        // The race itself, made deterministic: nothing is listening on this turn, so the one-shot
        // dial the suites used to make is refused here.
        #expect(CompanionClient(socketPath: path) == nil)
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

    /// A dial nothing ever answers still fails — and says the errno and whether the socket file was
    /// there, which is the reading three CI failures were spent guessing at.
    @Test
    func `a dial no listener ever answers fails in words rather than in nil`() async throws {
        let path = Self.temporaryPath()
        var said = ""
        do {
            _ = try await CompanionClient.dialled(path, within: .milliseconds(50))
        } catch let failure as CompanionClient.DialFailure {
            said = failure.description
        }

        #expect(said.contains(path))
        #expect(said.contains("not there"))
    }

    /// Short, because `sun_path` is 103 bytes and a temp directory plus a UUID spends them.
    private static func temporaryPath() -> String {
        "/tmp/argo-dial-\(UUID().uuidString.prefix(8)).sock"
    }
}
