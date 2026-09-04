@testable import ArgoEngine
import Foundation
import Testing

/// The `ask_user` tool, end to end (#1203): what the agent asks over the channel reaches the
/// roster as BOTH halves of an ask — the `asking` status and the words that were asked.
///
/// Its own suite beside `CompanionChannelTests` because the question is the one report with two
/// halves that can disagree: a Session reading `asking` with nothing published is the roster
/// telling the reader to answer something no surface can show them.
@Suite("Companion ask channel")
@MainActor
struct CompanionAskChannelTests {
    @Test
    func `a reported question reaches the roster with the words it asked`() async throws {
        try await CompanionChannelHarness.withChannel { fixture, client in
            try await CompanionChannelHarness.report(client, "ask_user", [
                "question": "Which branch should I cut from?",
                "options": ["main", "release"],
            ])
            await settle { fixture.hub.sessions.first?.reportedAsk != nil }

            let session = try #require(fixture.hub.sessions.first)
            let asked = try #require(session.reportedAsk)
            #expect(session.statusReading
                == SessionStatusReading(tier: .convention, status: .asking))
            #expect(asked.question == "Which branch should I cut from?")
            #expect(asked.ask.questions.map(\.text) == ["Which branch should I cut from?"])
            #expect(asked.ask.questions[0].options.map(\.label) == ["main", "release"])
            // Bare labels: the channel offers no second line, and a blank one is a different claim
            // from none at all.
            #expect(asked.ask.questions[0].options.allSatisfy { $0.detail == nil })
        }
    }

    /// The channel offers no second line under an option and no `multiSelect`, so the domain
    /// reading claims neither: an affordance the agent never asked for is one the row would lie
    /// about.
    @Test
    func `a question with no options reads as the free-form ask it is`() async throws {
        try await CompanionChannelHarness.withChannel { fixture, client in
            try await CompanionChannelHarness.report(
                client,
                "ask_user",
                ["question": "What should I call the branch?"],
            )
            await settle { fixture.hub.sessions.first?.reportedAsk != nil }

            let asked = try #require(fixture.hub.sessions.first?.reportedAsk)
            #expect(asked.ask.questions[0].options.isEmpty)
            #expect(!asked.ask.questions[0].allowsMultiple)
        }
    }

    /// A status that is no longer `asking` is the agent saying the question is behind it, so the
    /// row goes with the badge — a question left standing under `running` is one nobody is waiting
    /// on any more.
    @Test
    func `a question the agent has moved on from stops being published`() async throws {
        try await CompanionChannelHarness.withChannel { fixture, client in
            try await CompanionChannelHarness.report(
                client,
                "ask_user",
                ["question": "Which branch?"],
            )
            await settle { fixture.hub.sessions.first?.reportedAsk != nil }

            try await CompanionChannelHarness.report(
                client,
                "report_status",
                ["status": "running"],
            )
            await settle { fixture.hub.sessions.first?.convention?.status == .running }

            #expect(fixture.hub.sessions.first?.reportedAsk == nil)
        }
    }
}
