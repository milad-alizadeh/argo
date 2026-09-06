@testable import ArgoEngine
import Foundation
import Testing

/// The real transport: a real question about the fixture backlog, a real `codex exec`, real prose
/// back (#1315).
///
/// Gated on `ARGO_LIVE_CLI=1` beside `LiveCodex` and for its reasons — it needs the user's own
/// sign-in, and it takes as long as a model takes. Nothing here mocks the CLI: a suite that stubbed
/// it would prove the plumbing and none of the two things this ticket exists to find out.
@Suite("Backlog ask, live", .enabled(if: LiveCodex.isEnabled))
struct BacklogAskLiveTests {
    /// The question the design's own sheet draws: a thing described in words the backlog spells
    /// differently, so a substring match could not have found it.
    @Test
    func `a question about the fixture backlog comes back as prose`() async throws {
        let answer =
            try await ask("Is there a ticket about the build being slow in a new worktree?")

        #expect(!answer.prose.isEmpty)
        // #2 is titled "Warm the Swift build …" — no word of the question appears in it.
        #expect(answer.prose.contains("#2"))
    }

    @Test
    func `the answer says which sign-in paid for it and how long it took`() async throws {
        let answer = try await ask("Which tickets are bugs?")

        #expect(answer.answeredBy.email.contains("@"))
        #expect(answer.answeredBy.plan?.isEmpty == false)
        #expect(answer.took > .zero)
        #expect(answer.took < CodexBacklogAsk.patience)
    }

    /// The repeatability claim, run rather than asserted: the bodies say espresso machine and no
    /// answer may ever mention one.
    @Test
    func `the answer is written from the listing and not from a body`() async throws {
        let answer = try await ask("What is ticket 1 about?")

        #expect(!answer.prose.lowercased().contains("espresso"))
    }

    /// A question the listing cannot support is refused in prose rather than answered from what the
    /// model remembers of some other backlog.
    @Test
    func `a question the listing cannot answer is declined in the prose`() async throws {
        let answer = try await ask("Which ticket covers the billing export to Stripe?")

        #expect(!answer.prose.isEmpty)
    }

    private func ask(_ question: String) async throws -> BacklogAnswer {
        try await CodexBacklogAsk().answer(question, over: BacklogAskFixture.tickets).get()
    }
}
