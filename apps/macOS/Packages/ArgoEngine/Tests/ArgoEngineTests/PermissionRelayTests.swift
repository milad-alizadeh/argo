@testable import ArgoEngine
import Foundation
import Testing

/// The gate driven through the REAL hook script rather than a test client (#543). The relay's `nc`
/// half-closes the socket the moment its payload pipe ends, and a gate that reads that as the hook
/// dying refuses nothing and records nothing — the one failure only the shipped script can show.
///
/// Nested inside `PermissionChannelTests` for `Expiry`'s reason: one serial scope over the
/// main-queue socket waits.
extension PermissionChannelTests {
    @Suite("Permission gate through the real relay")
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
                try await hook.waitForPrompt(in: fixture)
                await anyHalfCloseHasLanded()
                #expect(fixture.hub.sessions.first?.permission != nil)

                clock.release()
                await settle {
                    fixture.hub.sessions.first?.expiredPermissions.isEmpty == false
                }

                #expect(fixture.hub.sessions.first?.expiredPermissions.map(\.toolName)
                    == ["Bash"])
                await settle { !hook.process.isRunning }
                let told = try hook.printed()
                #expect(told.contains("deny"), "\(told)")
                #expect(told.contains("expired"), "\(told)")
            }
        }

        @Test
        func `a hook killed with its turn takes the prompt away in silence`() async throws {
            try await PermissionGate.withGate { fixture, claim, _ in
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }
                try await hook.waitForPrompt(in: fixture)

                hook.process.terminate()
                await settle { fixture.hub.sessions.first?.permission == nil }

                #expect(fixture.hub.sessions.first?.permission == nil)
                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }

        /// The only cover the script's fail-closed branch has, and the one place its reason is a
        /// passing answer.
        ///
        /// Removing the socket file reaches that branch by a different route than #936 did — a dial
        /// refused rather than a path with nothing on it — and `[ -z "$decision" ]` is where both
        /// arrive.
        @Test
        func `a hook that cannot reach the gate denies the call rather than letting it run`()
            async throws {
            try await PermissionGate.withGate { fixture, claim, _ in
                #expect(unlink(PermissionGate.path(fixture, claim)) == 0)
                let hook = try RelayHook.launched(fixture, claim)
                defer { hook.end() }

                await settle { !hook.process.isRunning }
                let told = try hook.printed(allowingUnreachableGate: true)
                // PARSED, not searched: a CLI that cannot read what a hook said reads it as a hook
                // with no opinion, and runs the call.
                let line = told.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
                let decision = try #require(JSONValue.record(fromLine: line)?["hookSpecificOutput"])
                #expect(decision.stringField("permissionDecision") == "deny")
                // Also what ties the constant above to the script's own wording: a reword fails
                // HERE rather than leaving the guard on the two tests above silently passing.
                #expect(decision.stringField("permissionDecisionReason") == gateUnreachableReason)
            }
        }
    }
}
