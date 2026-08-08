@testable import ArgoEngine
import Testing

/// What the record says about a question the agent put to somebody: the words it asked, the options
/// it offered, and what came back. Every claim here is a claim that the reading carried them
/// verbatim — a question is the one thing in a transcript a surface may not paraphrase, because the
/// options are what somebody is about to choose between.
@Suite("Ask reading")
struct AskReadingTests {
    private func calls() async throws -> [String: ToolCall] {
        try await Fixture.events("askOffered").reduce(into: [:]) { found, event in
            guard case let .toolCall(call) = event else { return }
            found[call.id] = call
        }
    }

    @Test
    func `a question is read with the options it offered, in the order it offered them`(
    ) async throws {
        let ask = try #require(await calls()["ask-pending"]?.ask)

        #expect(ask.questions.map(\.text) == ["Which ink does a prompt still waiting take?"])
        #expect(ask.questions.first?.options == ["The attention ink", "The ordinary ink"])
    }

    /// An option carrying a description offers its LABEL — the words on the control somebody
    /// presses. The description explains the option; it is not the option.
    @Test
    func `an option is read as the label it was offered under`() async throws {
        let ask = try #require(await calls()["ask-answered"]?.ask)

        #expect(ask.questions.first?.options == ["On the option itself", "Beside the question"])
    }

    @Test
    func `a question with no words in it is not read as a question at all`() async throws {
        #expect(try await calls()["ask-unreadable"]?.ask == nil)
    }

    /// The answer is kept because it is the only place the choice is written down. Without it the
    /// feed can say a question was asked and never which way it went.
    @Test
    func `the answer a question was given is kept verbatim`() async throws {
        let outcomes = try await Fixture.events("askOffered").outcomes()
        guard case let .output(output) = try #require(outcomes["ask-answered"]?.result) else {
            Issue.record("an answered question carries what came back")
            return
        }

        #expect(output.text.contains("On the option itself"))
    }

    @Test
    func `a question nothing has answered carries no outcome`() async throws {
        #expect(try await Fixture.events("askOffered").outcomes()["ask-pending"] == nil)
    }

    /// A subagent's turns run in a sidechain the parent transcript does not attribute, so the
    /// delegating call's own result is the only place its spend is ever reported.
    @Test
    func `a delegating call's spend is read from what its result reported`() async throws {
        let usage = try #require(await Fixture.events("askOffered").outcomes()["call-verify"]?
            .usage)

        #expect(usage.inputTokens == 1200)
        #expect(usage.outputTokens == 3400)
        #expect(usage.cacheReadTokens == 139_000)
    }
}
