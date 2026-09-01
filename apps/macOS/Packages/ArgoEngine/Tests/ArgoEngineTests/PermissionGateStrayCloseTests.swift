@testable import ArgoEngine
import Darwin
import Foundation
import Testing

/// #936 itself, staged rather than waited for: the reported failure with no load and no timing.
///
/// The recorded signature was a hook dialling a gate and being refused 127 times in three seconds
/// while the socket file sat there on disk, with no close of that listener logged anywhere. This
/// builds exactly that — a client releases its number, a gate is opened and handed the number back,
/// and the client, already closed, is closed a second time. Before the fix the dial after it is
/// `ECONNREFUSED` against a file still present, which is the ticket's own evidence line.
@Suite("The stray close and the gate")
@MainActor
struct PermissionGateStrayCloseTests {
    @Test
    func `a gate handed a closed client's number is not refused when that client closes again`()
        async throws {
        try await PermissionGate.withGate { fixture, _, client in
            let number = client.descriptor
            client.close()
            let path = fixture.companionRoot.appending(path: "rival.gate.sock").path
            // Not staged, nothing to prove — see `staging`. The ownership suite forbids the same
            // close with no staging at all, so this one is never the only guard.
            guard let staged = await Self.staging(number, at: path) else { return }
            defer { staged.give() }
            #expect(Self.dials(path), "the gate answers before the stray close")

            client.close()

            #expect(Self.dials(path), "the gate was refused after a closed client closed again")
            #expect(FileManager.default.fileExists(atPath: path), "with its file still on disk")
        }
    }

    /// A gate listening on exactly the number the closed client released.
    ///
    /// `nil` where the kernel would not oblige: the suites running beside this one open and close
    /// descriptors of their own, so the free numbers below it move under the attempt. Retried, then
    /// skipped — a staging that did not come off is not a verdict on the client.
    private static func staging(_ number: Int32, at path: String) async -> Staged? {
        for _ in 0 ..< 8 {
            guard let held = ReclaimedDescriptor.taking(number) else {
                await Task.yield()
                continue
            }
            held.releaseNumber()
            let gate = CompanionSocket(path: path) { _ in nil }
            if (try? gate.open()) != nil, name(boundTo: number) == path {
                return Staged(gate: gate, held: held)
            }
            gate.close()
            held.dropHeld()
            // The cancel handler is what closes a gate's descriptor, and it runs on the main
            // queue: without letting it turn, the next attempt asks for a number still held.
            await Task.yield()
        }
        return nil
    }

    @MainActor
    private struct Staged {
        let gate: CompanionSocket
        let held: ReclaimedDescriptor

        func give() {
            gate.close()
            held.dropHeld()
        }
    }

    /// Whether a dial is answered, spelled the way the hook's relay spells it: a refused connect is
    /// `nil`, which is what `/usr/bin/nc -U` reports as silence.
    private static func dials(_ path: String) -> Bool {
        guard let dialled = CompanionClient.dialledOnce(path) else { return false }
        dialled.close()
        return true
    }

    /// The path this NUMBER is bound to, so the staging is asserted rather than assumed.
    private static func name(boundTo number: Int32) -> String? {
        var address = sockaddr_un()
        var size = socklen_t(MemoryLayout<sockaddr_un>.size)
        let named = withUnsafeMutablePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                getsockname(number, $0, &size)
            }
        }
        guard named == 0 else { return nil }
        let bytes = withUnsafeBytes(of: &address.sun_path) { raw in
            raw.prefix { $0 != 0 }.map { UInt8($0) }
        }
        return String(bytes: bytes, encoding: .utf8)
    }
}
