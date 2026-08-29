@testable import ArgoEngine
import Foundation
import Testing

/// The gate driven through the REAL hook script rather than a test client (#543). The relay's
/// `nc` half-closes the socket the moment its payload pipe ends, and a gate that reads that as
/// the hook dying refuses nothing and records nothing — the one failure only the shipped script
/// can show.
///
/// Nested inside `PermissionChannelTests` for `Expiry`'s reason: one serial scope over the
/// main-queue socket waits.
extension PermissionChannelTests {
    @Suite("Permission expiry through the real relay")
    @MainActor
    struct Relay {
        @Test
        func `a hook that outlives its payload is still told when the gate expires the call`()
            async throws {
            let clock = HeldPermissionClock()
            try await PermissionGate.withGate(patience: clock.patience) { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }

                // The payload's pipe is already closed, so any half-close has already happened:
                // the prompt must be raised AND survive it.
                await settle { fixture.hub.sessions.first?.permission != nil }
                await anyHalfCloseHasLanded()
                #expect(fixture.hub.sessions.first?.permission != nil)

                clock.release()
                await settle {
                    fixture.hub.sessions.first?.expiredPermissions.isEmpty == false
                }

                #expect(fixture.hub.sessions.first?.expiredPermissions.map(\.toolName)
                    == ["Bash"])
                await settle { !hook.process.isRunning }
                let told = hook.printed()
                #expect(told.contains("deny"), "\(told)")
                #expect(told.contains("expired"), "\(told)")
            }
        }

        @Test
        func `a hook killed with its turn takes the prompt away in silence`() async throws {
            try await PermissionGate.withGate { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }
                await settle { fixture.hub.sessions.first?.permission != nil }

                hook.process.terminate()
                await settle { fixture.hub.sessions.first?.permission == nil }

                #expect(fixture.hub.sessions.first?.permission == nil)
                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }
    }
}

/// Long enough that a half-close, which the socket carries within microseconds of the payload
/// beside it, has reached the gate as its own read event and been acted on.
///
/// NOTHING races this: the clock above is held, so the prompt cannot end while it runs. A machine
/// too slow for it makes the test slow rather than red, which is the direction #826 is about.
private func anyHalfCloseHasLanded() async {
    try? await Task.sleep(for: .milliseconds(250))
}
