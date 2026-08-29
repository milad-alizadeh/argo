@testable import ArgoEngine
import Darwin
import Testing

/// Who owns the descriptor a test client dials on.
///
/// A suite about the FIXTURE, which is unusual and deliberate. `CompanionClient` was a struct
/// holding a raw `Int32`, so `withGate`'s `defer { client.close() }` and the four bodies that also
/// close it each closed the same number — and the kernel hands out the LOWEST free number, so the
/// second close landed on whatever the suites running beside it had opened in between. When that
/// was a gate's listening socket, every hook dialling it was refused for the rest of the Session
/// while the socket file sat there on disk (#936).
@Suite("Companion client ownership")
@MainActor
struct CompanionClientOwnershipTests {
    @Test
    func `a client closed twice never takes the number the kernel has reissued`() async throws {
        try await PermissionGate.withGate { _, _, client in
            let number = client.descriptor
            client.close()
            let reissued = try #require(Self.reclaiming(number))
            defer { Darwin.close(reissued) }

            client.close()

            #expect(
                fcntl(number, F_GETFD) != -1,
                "the second close took fd \(number) back off whoever the kernel had given it to",
            )
        }
    }

    /// The freed number, taken back. It is the first socket opened here unless a suite running
    /// beside this one got there first, so the others are held until it comes up and then dropped.
    private static func reclaiming(_ number: Int32) -> Int32? {
        var taken: [Int32] = []
        while taken.count < 64, !taken.contains(number) {
            let opened = socket(AF_UNIX, SOCK_STREAM, 0)
            guard opened >= 0 else { break }
            taken.append(opened)
        }
        for other in taken where other != number {
            Darwin.close(other)
        }
        return taken.contains(number) ? number : nil
    }
}
