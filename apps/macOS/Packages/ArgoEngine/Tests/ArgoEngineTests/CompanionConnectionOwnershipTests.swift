@testable import ArgoEngine
import Darwin
import Testing

/// Who owns the descriptor an accepted connection is handed — both ends of the lifetime, because a
/// connection that released nothing would pass a suite that only forbids releasing twice.
///
/// The mirror of `CompanionClientOwnershipTests` on the server side. `CompanionConnection` had no
/// `deinit`, so a connection dropped rather than closed held its number for the life of the
/// process; the fix must not turn that leak into the double close of #936.
@Suite("Companion connection ownership")
@MainActor
struct CompanionConnectionOwnershipTests {
    /// A connected pair, so the release is read off the FAR end as a hang-up rather than off the
    /// number. These suites run in one process and in parallel, so a number this test released is
    /// one another suite may already have been given — the very reuse #936 was about, and it makes
    /// "the number is closed" a claim that decays while a wait is still polling it.
    private struct Pair {
        let near: Int32
        let far: Int32

        init() throws {
            var ends: [Int32] = [-1, -1]
            try #require(socketpair(AF_UNIX, SOCK_STREAM, 0, &ends) == 0)
            self.near = ends[0]
            self.far = ends[1]
            _ = fcntl(far, F_SETFL, O_NONBLOCK)
        }

        /// A stream socket reads 0 once its peer is released, and `EAGAIN` while it is still there.
        var isNearEndReleased: Bool {
            var byte: UInt8 = 0
            return read(far, &byte, 1) == 0
        }

        func dropFar() {
            Darwin.close(far)
        }
    }

    private static func connection(on descriptor: Int32) -> CompanionConnection {
        CompanionConnection(descriptor: descriptor, respond: { _, _ in }, onClose: {})
    }

    @Test
    func `a connection dropped before it opened releases its descriptor`() throws {
        let pair = try Pair()
        defer { pair.dropFar() }

        var connection: CompanionConnection? = Self.connection(on: pair.near)
        _ = connection
        connection = nil

        #expect(pair.isNearEndReleased, "the dropped connection held its descriptor")
    }

    /// The descriptor never reached a source, so no cancel handler is standing to close it and
    /// `close` has to do it itself — the leak a sentinel set on every path would hide.
    @Test
    func `a connection closed before it opened releases its descriptor`() throws {
        let pair = try Pair()
        defer { pair.dropFar() }

        let connection = Self.connection(on: pair.near)
        connection.close()

        #expect(pair.isNearEndReleased, "the closed connection held its descriptor")
    }

    @Test
    func `a connection dropped while still reading releases its descriptor`() async throws {
        let pair = try Pair()
        defer { pair.dropFar() }

        var connection: CompanionConnection? = Self.connection(on: pair.near)
        connection?.open()
        connection = nil

        // The read source's cancel handler is what releases it, and `cancel` is asynchronous — so
        // the release lands a main-queue hop after the drop rather than inside it.
        await settle { pair.isNearEndReleased }
        #expect(pair.isNearEndReleased, "the dropped connection held its descriptor")
    }

    /// The other end of the same lifetime: a connection closed by hand and then dropped must not
    /// close the number a second time, because by then the kernel has reissued it (#936).
    @Test
    func `a closed connection never takes its number back`() async throws {
        let pair = try Pair()
        defer { pair.dropFar() }

        var connection: CompanionConnection? = Self.connection(on: pair.near)
        connection?.open()
        connection?.close()
        await settle { pair.isNearEndReleased }

        // No reclaim, nothing to prove: the scenario could not be staged, which is not a verdict
        // on the connection. Every other run of this test says what this one cannot.
        guard let reclaimed = ReclaimedDescriptor.taking(pair.near) else {
            connection = nil
            return
        }
        defer { reclaimed.dropAll() }

        connection = nil

        #expect(
            fcntl(pair.near, F_GETFD) != -1,
            "the drop took fd \(pair.near) back off whoever the kernel had given it to",
        )
    }
}
