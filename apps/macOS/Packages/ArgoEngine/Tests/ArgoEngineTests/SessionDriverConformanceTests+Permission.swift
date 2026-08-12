@testable import ArgoEngine
import Foundation
import Testing

/// The Permission half of the port's claims, run against EVERY adapter (#549).
///
/// The point of running these twice is the fourth acceptance criterion: a Permission from Codex has
/// to be indistinguishable in the cockpit from Claude's. So nothing below reads a socket or a
/// JSON-RPC line — every assertion is on the roster row the cockpit draws, and both CLIs raise the
/// same command so the two rows are comparable as one value.
extension SessionDriverConformanceTests {
    @Suite("Session drive conformance · Permission")
    @MainActor
    struct Permission {
        @Test(arguments: DrivenCLI.allCases)
        func `a gated call becomes a Permission naming the tool and its target`(
            cli: DrivenCLI,
        ) async throws {
            try await Self.gated(cli) { fixture, session in
                try session.gate.raise()
                _ = await settle { fixture.hub.sessions.first?.permission != nil }

                let raised = try #require(fixture.hub.sessions.first?.permission)
                #expect(!raised.toolName.isEmpty)
                #expect(raised.target == .command(DrivenGate.command))
                #expect(fixture.hub.sessions.first?.status == .permission)
            }
        }

        @Test(arguments: DrivenCLI.allCases)
        func `an allow lets the gated call through and takes the prompt away`(
            cli: DrivenCLI,
        ) async throws {
            try await Self.gated(cli) { fixture, session in
                let raised = try await Self.raised(fixture, session)

                try fixture.hub.driver.decide(.allow, answering: raised.id, for: session.id)

                _ = await settle { session.gate.allowed() != nil }
                #expect(session.gate.allowed() == true)
                #expect(fixture.hub.sessions.first?.permission == nil)
            }
        }

        @Test(arguments: DrivenCLI.allCases)
        func `a deny refuses the gated call and takes the prompt away`(
            cli: DrivenCLI,
        ) async throws {
            try await Self.gated(cli) { fixture, session in
                let raised = try await Self.raised(fixture, session)

                try fixture.hub.driver.decide(.deny, answering: raised.id, for: session.id)

                _ = await settle { session.gate.allowed() != nil }
                #expect(session.gate.allowed() == false)
                #expect(fixture.hub.sessions.first?.permission == nil)
            }
        }

        /// Neither CLI ends an unanswered approval itself — `codex`'s server keeps no clock at all
        /// (openai/codex#11816). So the clock is ARGO's on both, it answers no, and the Session
        /// says so: a Turn is never left hanging on a prompt nobody read.
        @Test(arguments: DrivenCLI.allCases)
        func `a Permission nobody answers is refused by Argo's own clock`(
            cli: DrivenCLI,
        ) async throws {
            try await Self.gated(cli, patience: .immediate) { fixture, session in
                try session.gate.raise()

                _ = await settle { session.gate.allowed() != nil }
                #expect(session.gate.allowed() == false)
                _ = await settle {
                    fixture.hub.sessions.first?.expiredPermissions.isEmpty == false
                }
                #expect(fixture.hub.sessions.first?.expiredPermissions.count == 1)
                #expect(fixture.hub.sessions.first?.permission == nil)
            }
        }

        /// A decision that raced the clock is reported rather than swallowed, and never falls
        /// through to the prompt that replaced the one the user read.
        @Test(arguments: DrivenCLI.allCases)
        func `a decision for a call that is no longer waiting is refused`(
            cli: DrivenCLI,
        ) async throws {
            try await Self.gated(cli) { fixture, session in
                #expect(throws: SessionDriveError.nothingPending) {
                    try fixture.hub.driver.decide(
                        .allow,
                        answering: "a-call-that-went",
                        for: session.id,
                    )
                }
            }
        }

        @Test(arguments: DrivenCLI.allCases)
        func `a revocation of a standing allow this Session never made is refused`(
            cli: DrivenCLI,
        ) async throws {
            try await Self.gated(cli) { fixture, session in
                #expect(throws: SessionDriveError.noSuchGrant) {
                    try fixture.hub.driver.revokeStandingAllow("Bash", for: session.id)
                }
            }
        }

        /// One spawned Session of the named CLI with its gate dialled in, torn down after.
        private static func gated(
            _ cli: DrivenCLI,
            patience: PermissionPatience = .default,
            _ body: (SpawnFixture, DrivenSession) async throws -> Void,
        ) async throws {
            let fixture = try SpawnFixture(permissionPatience: patience)
            defer { fixture.remove() }
            let session = try await fixture.drive(cli)
            defer { session.gate.close() }
            try await body(fixture, session)
        }

        /// The Permission the cockpit is showing, once it is showing one.
        private static func raised(
            _ fixture: SpawnFixture,
            _ session: DrivenSession,
        ) async throws
            -> PermissionRequest {
            try session.gate.raise()
            _ = await settle { fixture.hub.sessions.first?.permission != nil }
            return try #require(fixture.hub.sessions.first?.permission)
        }
    }
}
