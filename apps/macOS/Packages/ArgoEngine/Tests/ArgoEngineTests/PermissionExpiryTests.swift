@testable import ArgoEngine
import Foundation
import Testing

/// What becomes of a Permission nobody answers (#573) — and, just as much, what does NOT become of
/// one the user cancelled the turn under.
///
/// Nested inside `PermissionChannelTests` rather than standing beside it, and that is not filing:
/// `.serialized` orders a suite's own tests and nothing else, so two sibling suites of socket waits
/// would drive one main queue in parallel — the starvation the parent's own note describes,
/// reappearing between the suites instead of inside one. Nesting puts both under one serial scope.
extension PermissionChannelTests {
    @Suite("Permission expiry")
    @MainActor
    struct Expiry {
        @Test
        func `a prompt nobody answers is refused by the gate itself and said to be unanswered`()
            async throws {
            try await PermissionGate.withGate(patience: .immediate) { fixture, _, client in
                client.sendLine(PermissionGate.bashCall)
                await settle { fixture.hub.sessions.first?.expiredPermissions.isEmpty == false }

                let decision = try await PermissionGate.decision(read: client)

                // Denied on the wire, because the hook's vocabulary has no third word — and the
                // reason names Argo, so the CLI's own record of the refused call cannot read as a
                // person having refused it.
                #expect(decision.stringField("permissionDecision") == "deny")
                #expect(
                    decision.stringField("permissionDecisionReason")?.contains("expired") == true,
                )
                #expect(fixture.hub.sessions.first?.expiredPermissions.map(\.toolName) == ["Bash"])
                // The prompt goes with it: a call already refused is not one still waiting on
                // anybody.
                #expect(fixture.hub.sessions.first?.permission == nil)
                #expect(fixture.hub.sessions.first?.status != .permission)
            }
        }

        @Test
        func `a prompt that goes with the turn it belonged to says nothing at all`() async throws {
            // The live patience — a day — so the hook going is the ONLY thing that ends this
            // prompt.
            try await PermissionGate.withGate { fixture, _, client in
                client.sendLine(PermissionGate.bashCall)
                await settle { fixture.hub.sessions.first?.permission != nil }

                client.close()
                await settle { fixture.hub.sessions.first?.permission == nil }

                // Silence is the answer. Cancelling a turn is the user deciding, and a notice
                // explaining what they just did explains nothing.
                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }

        @Test
        func `an answered prompt never expires behind the answer`() async throws {
            try await PermissionGate.withGate { fixture, claim, client in
                client.sendLine(PermissionGate.bashCall)
                await settle { fixture.hub.sessions.first?.permission != nil }
                let waiting = try #require(fixture.hub.sessions.first?.permission)

                try fixture.hub.driver.decide(.allow, answering: waiting.id, for: claim.value)
                _ = try await PermissionGate.decision(read: client)

                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }

        @Test
        func `the hook is told to wait LONGER than the gate does, never the same`() {
            // The ordering is the whole mechanism: Argo's clock has to run out first, or an expiry
            // arrives as a killed hook — a peer close indistinguishable from a cancelled turn.
            #expect(PermissionPatience.hookTimeoutSeconds > PermissionPatience.default.seconds)
        }

        @Test
        func `a claim that ends takes its expiries with it`() async throws {
            try await PermissionGate.withGate(patience: .immediate) { fixture, claim, client in
                client.sendLine(PermissionGate.bashCall)
                await settle { fixture.hub.sessions.first?.expiredPermissions.isEmpty == false }

                fixture.host.endLastProcess(exitCode: 0)
                await settle { fixture.hub.expiredPermissions[claim] == nil }

                #expect(fixture.hub.sessions.first?.expiredPermissions.isEmpty == true)
            }
        }
    }
}
