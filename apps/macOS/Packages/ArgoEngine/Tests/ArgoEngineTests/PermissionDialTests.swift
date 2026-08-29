@testable import ArgoEngine
import Foundation
import Testing

/// What the relay says when there is no gate to reach (#936).
@Suite("Permission gate dialling")
@MainActor
struct PermissionDialTests {
    /// The one place `Argo could not be reached to ask` is a pass: a gate that is not there is
    /// what those words are FOR, and anywhere else they are the missed accept #936 names.
    @Test
    func `a gate that never comes up is denied in the hook's own words`() async throws {
        let gate = try DialFixture()
        defer { gate.remove() }
        let hook = try RelayHook.launched(script: gate.hookScript)
        defer { hook.end() }

        await settle { !hook.process.isRunning }

        let told = hook.printed()
        #expect(told.contains("deny"), "\(told)")
        #expect(told.contains("Argo could not be reached to ask"), "\(told)")
    }
}

/// A materialized companion plugin whose gate socket has no listener: the hook on one side of the
/// dial and, until a test puts one there, nothing on the other.
@MainActor
private struct DialFixture {
    let hookScript: URL
    let socketPath: String
    private let root: URL

    init() throws {
        // Short, for the reason every companion root in these suites is: a `sockaddr_un` path is
        // 103 bytes.
        let claim = SessionOwnership.ClaimID(value: "dial")
        self.root = URL(
            fileURLWithPath: "/tmp/argo-d-\(UUID().uuidString.prefix(8))",
            isDirectory: true,
        )
        self.socketPath = root.appending(path: "\(claim.value).gate.sock").path
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        _ = try CompanionPlugin.materialize(
            forClaim: claim,
            under: root,
            socketPath: root.appending(path: "\(claim.value).sock").path,
            gatedBy: socketPath,
        )
        self.hookScript = root.appending(path: claim.value)
            .appending(path: "permission-hook.sh")
    }

    func remove() {
        try? FileManager.default.removeItem(at: root)
    }
}
