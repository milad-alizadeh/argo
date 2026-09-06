@testable import ArgoEngine
import Foundation
import Testing

/// The two numbers the design is waiting on (#1315): how long an answer takes, and whether one is
/// any good from titles, labels and edges alone.
///
/// Its own gate, `ARGO_MEASURE_ASK=1`, because it costs a question per shape and the live suite is
/// already the expensive one. Serialised: two questions in flight would measure the CLI's
/// concurrency rather than a reader's wait, which is what the sheet is sized against.
///
/// **It prints rather than asserts, and that is deliberate.** A latency threshold would fail on
/// somebody else's network instead of on a regression, and answer quality is a judgement a person
/// makes by reading four answers. The one assertion is the claim the port itself rests on.
@Suite("Backlog ask, measured", .enabled(if: BacklogAskMeasure.isEnabled), .serialized)
struct BacklogAskMeasureTests {
    @Test
    func `a question over the fixture backlog is answered in the time it takes`() async throws {
        let port = CodexBacklogAsk()
        var answers: [BacklogAnswer] = []
        for question in BacklogAskMeasure.questions {
            let answer = try await port.answer(question, over: BacklogAskFixture.tickets).get()
            answers.append(answer)
            print("Q: \(question)\nA (\(answer.took.milliseconds)ms): \(answer.prose)\n")
        }

        BacklogAskMeasure.report(answers.map(\.took))

        #expect(answers.allSatisfy { $0.took < CodexBacklogAsk.patience })
    }
}

enum BacklogAskMeasure {
    nonisolated static let isEnabled =
        ProcessInfo.processInfo.environment["ARGO_MEASURE_ASK"] == "1"

    /// Four shapes, because a one-word lookup and a question spanning the whole listing are not the
    /// same wait: a citation from a paraphrase, a survey, a traversal of the edges, and one the
    /// listing cannot answer at all.
    static let questions = [
        "Is there a ticket about the build being slow in a new worktree?",
        "Which tickets are bugs, and which of those has the highest priority?",
        "What is blocking the Atlas tickets, and which one has to land first?",
        "Which ticket covers the billing export to Stripe?",
    ]

    /// Least-of-N is the number to quote. The machine is a variable — a Spotlight index or another
    /// model in flight moves the mean and never the floor — so the floor is what is comparable
    /// between two runs of this on different days.
    static func report(_ took: [Duration]) {
        let sorted = took.map(\.milliseconds).sorted()
        guard let least = sorted.first, let most = sorted.last else { return }
        print("""
        backlog ask latency over \(BacklogAskFixture.tickets.count) tickets, \
        \(sorted.count) questions: least \(least)ms · median \(sorted[sorted.count / 2])ms · \
        most \(most)ms
        """)
    }
}
