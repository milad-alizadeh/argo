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
        // Never `plan != nil`: the type documents a sign-in whose token names no plan as valid, and
        // an assertion contradicting that fails on a real machine rather than on a defect.
        #expect(answer.answeredBy.plan.map { !$0.isEmpty } ?? true)
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

    /// A question the listing cannot support is declined rather than answered from what the model
    /// remembers of some other backlog.
    ///
    /// The claim is checked as **no citation**, not as a form of words: the fixture holds nothing
    /// about Stripe, so any `#N` here is a ticket invented to satisfy the question, which is the
    /// failure the design calls the worst one it can draw.
    @Test
    func `a question the listing cannot answer cites no ticket`() async throws {
        let answer = try await ask("Which ticket covers the billing export to Stripe?")

        #expect(!answer.prose.isEmpty)
        #expect(!answer.prose.contains("#"))
    }

    /// The design's Stop, run rather than asserted (`cockpit-backlog-question.md`, **The wait**).
    /// Cancelling must come back long before the 25 s patience, or the wait cannot be stopped at
    /// all — which is the shape this suite exists to catch on the real CLI.
    @Test
    func `a stopped question comes back at once, not at the patience`() async throws {
        let clock = ContinuousClock()
        let started = clock.now
        let asking = Task {
            await CodexBacklogAsk().answer(
                "Which tickets are bugs?",
                over: BacklogAskFixture.tickets,
            )
        }
        try await Task.sleep(for: .milliseconds(300))
        asking.cancel()
        let outcome = await asking.value

        #expect(clock.now - started < .seconds(10))
        #expect(throws: BacklogAskRefusal.self) { try outcome.get() }
    }

    private func ask(_ question: String) async throws -> BacklogAnswer {
        try await CodexBacklogAsk().answer(question, over: BacklogAskFixture.tickets).get()
    }
}
