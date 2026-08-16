@testable import ArgoEngine
import Foundation
import Testing

/// The ask half of the gate, end to end: an `AskUserQuestion` blocks the agent the way a gated call
/// does, raises a live ask in the roster, and the answer goes back down the same socket.
///
/// NESTED inside the permission suite, and that is what makes it correct rather than tidy. Both
/// halves drive a `DispatchSource` on the MAIN queue and wait on the main actor for it to fire, so
/// `.serialized` within each suite is not enough — run as siblings the two starve each other's
/// event handler, and a socket that never gets accepted fails as "the agent never asked". One
/// serialized parent is one runloop at a time.
extension PermissionChannelTests {
    @Suite("Ask channel")
    @MainActor
    struct AskChannelTests {
        /// One `AskUserQuestion`, as the hook's relay would put it.
        private static let askCall = """
        {"tool_name":"AskUserQuestion","tool_input":{"questions":[{\
        "question":"Which ticket should I implement?","multiSelect":false,\
        "options":[{"label":"#712","description":"Closest to this worktree."},{"label":"#713"}]}]}}
        """

        @Test
        func `the plugin puts the ask through the same gate a permission goes through`(
        ) async throws {
            let fixture = try SpawnFixture()
            defer { fixture.remove() }

            let claim = try await fixture.hub.spawnSession()
            let hooks = try String(
                contentsOf: fixture.companionRoot
                    .appending(path: claim.value)
                    .appending(path: "hooks/hooks.json"),
                encoding: .utf8,
            )

            #expect(hooks.contains(ToolCall.askUserQuestion))
        }

        @Test
        func `an AskUserQuestion raises a live ask the Session reads DIRECT`() async throws {
            try await PermissionGate.withGate { fixture, _, client in
                client.sendLine(Self.askCall)
                await settle { fixture.hub.sessions.first?.ask != nil }

                let session = try #require(fixture.hub.sessions.first)
                let ask = try #require(session.ask)
                #expect(ask.ask.questions.first?.text == "Which ticket should I implement?")
                #expect(ask.ask.questions.first?.options.map(\.label) == ["#712", "#713"])
                // It is a question, never a Permission: the two are answered by different acts and
                // the
                // composer's slot must not fill with a prompt nobody can answer.
                #expect(session.permission == nil)
            }
        }

        /// The Session shows *needs input* and holds there until it is answered.
        @Test
        func `a Session with an ask waiting is asking`() async throws {
            try await PermissionGate.withGate { fixture, _, client in
                client.sendLine(Self.askCall)
                await settle { fixture.hub.sessions.first?.ask != nil }

                #expect(fixture.hub.sessions.first?.statusReading == SessionStatusReading(
                    tier: .direct,
                    status: .asking,
                ))
            }
        }

        @Test
        func `the answer goes back down the hook and clears the ask`() async throws {
            try await PermissionGate.withGate { fixture, claim, client in
                client.sendLine(Self.askCall)
                await settle { fixture.hub.sessions.first?.ask != nil }

                let waiting = try #require(fixture.hub.sessions.first?.ask)
                try fixture.hub.driver.answer(
                    AskAnswer(replies: [AskAnswer.Reply(question: 0, ordinals: [2])]),
                    answering: waiting.id,
                    for: claim.value,
                )
                let decision = try await PermissionGate.decision(read: client)

                #expect(decision.stringField("permissionDecision") == "deny")
                let reason = try #require(decision.stringField("permissionDecisionReason"))
                #expect(reason.contains("2. #713"))
                #expect(fixture.hub.sessions.first?.ask == nil)
            }
        }

        /// The top rung asks nothing about a Bash call, but an ask is not a boundary being crossed
        /// —
        /// it is the agent wanting to know something, and `Auto` does not answer questions on the
        /// user's behalf.
        @Test
        func `a question is put even on Auto, where a gated call would be waved through`(
        ) async throws {
            try await PermissionGate.withGate(on: .auto) { fixture, _, client in
                client.sendLine(Self.askCall)
                await settle { fixture.hub.sessions.first?.ask != nil }

                #expect(fixture.hub.sessions.first?.ask != nil)
            }
        }

        @Test
        func `an answer to an ask that is no longer waiting is refused in the seam's words`(
        ) async throws {
            let fixture = try SpawnFixture()
            defer { fixture.remove() }
            let claim = try await fixture.hub.spawnSession()

            #expect(throws: SessionDriveError.nothingPending) {
                try fixture.hub.driver.answer(
                    AskAnswer(replies: []),
                    answering: "ask-1",
                    for: claim.value,
                )
            }
        }

        /// The hook went while Argo was still willing to wait, so its turn was cancelled: the
        /// question
        /// goes without a word, exactly as a Permission does (#573).
        @Test
        func `a hook that goes unanswered takes its question with it`() async throws {
            try await PermissionGate.withGate { fixture, _, client in
                client.sendLine(Self.askCall)
                await settle { fixture.hub.sessions.first?.ask != nil }

                client.close()
                await settle { fixture.hub.sessions.first?.ask == nil }

                #expect(fixture.hub.sessions.first?.ask == nil)
            }
        }

        /// A call NAMED `AskUserQuestion` whose input carried no readable question is not one
        /// anybody
        /// can answer, so it falls through to the gate's ordinary reading rather than raising a
        /// blank.
        @Test
        func `an AskUserQuestion with no question in it is a Permission like any other`(
        ) async throws {
            try await PermissionGate.withGate { fixture, _, client in
                client.sendLine(#"{"tool_name":"AskUserQuestion","tool_input":{"questions":[]}}"#)
                await settle { fixture.hub.sessions.first?.permission != nil }

                #expect(fixture.hub.sessions.first?.ask == nil)
                #expect(fixture.hub.sessions.first?.permission?.toolName == ToolCall
                    .askUserQuestion)
            }
        }

        /// The PTY is gone: nothing can be waiting on it, and a question left standing would be an
        /// affordance whose answer reaches nobody.
        @Test
        func `a withdrawn claim takes its question with it`() async throws {
            try await PermissionGate.withGate { fixture, claim, client in
                client.sendLine(Self.askCall)
                await settle { fixture.hub.sessions.first?.ask != nil }

                fixture.hub.permissions?.withdraw(claim)

                #expect(fixture.hub.sessions.first?.ask == nil)
            }
        }
    }
}
