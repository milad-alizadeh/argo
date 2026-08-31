@testable import ArgoEngine
import Foundation
import Testing

/// A socket's path is its own (#987): the unlink before a bind clears a file a dead process left,
/// and it must never clear one a live socket here is listening on.
///
/// Checkable rather than argued: the socket that created a path is the only thing that may remove
/// it, so a second socket on that path is refused at `open` and its `close` is not an unlink.
///
/// Both sockets here are in ONE process, which is the scope of the guard — across processes the
/// paths cannot collide at all, because `CompanionScope` names each Hub's directory by pid.
@Suite("A socket's own path")
@MainActor
struct CompanionSocketPathOwnershipTests {
    @Test
    func `a path a live socket holds refuses a second socket, whose close leaves the file`() throws {
        let root = try Self.root()
        defer { try? FileManager.default.removeItem(at: root) }
        let path = root.appending(path: "held.sock").path
        let held = CompanionSocket(path: path) { _ in nil }
        try held.open()
        defer { held.close() }

        let rival = CompanionSocket(path: path) { _ in nil }
        #expect(throws: AgentSpawnError.self) { try rival.open() }
        rival.close()

        #expect(FileManager.default.fileExists(atPath: path), "the file the held socket bound")
        let dialled = try #require(CompanionClient(socketPath: path), "still answers a dial")
        dialled.close()
    }

    /// The other half of the same rule: a path nothing is listening on any more is free, or a
    /// withdrawn claim's gate could never be opened again.
    @Test
    func `a path is bindable again once the socket that held it has closed`() throws {
        let root = try Self.root()
        defer { try? FileManager.default.removeItem(at: root) }
        let path = root.appending(path: "held.sock").path
        let first = CompanionSocket(path: path) { _ in nil }
        try first.open()
        first.close()
        #expect(!FileManager.default.fileExists(atPath: path), "its own close unlinks it")

        let second = CompanionSocket(path: path) { _ in nil }
        try second.open()
        defer { second.close() }

        let dialled = try #require(CompanionClient(socketPath: path))
        dialled.close()
    }

    /// Short and under `/tmp`, for the reason every companion root in these suites is: a
    /// `sockaddr_un` path is 103 bytes.
    private static func root() throws -> URL {
        let root = URL(
            fileURLWithPath: "/tmp/argo-so-\(UUID().uuidString.prefix(8))",
            isDirectory: true,
        )
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
