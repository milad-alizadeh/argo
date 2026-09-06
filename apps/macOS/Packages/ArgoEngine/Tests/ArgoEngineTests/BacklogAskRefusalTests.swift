@testable import ArgoEngine
import Foundation
import Testing

/// Every way the ask can fail, and the claim that none of them is an empty answer (#1315).
///
/// These run everywhere: each drives the real port, and each is arranged so it refuses before a
/// process would start.
@Suite("Backlog ask refusals")
struct BacklogAskRefusalTests {
    @Test
    func `no sign-in refuses instead of asking`() async throws {
        let home = try TemporaryCodexHome(auth: nil)
        defer { home.remove() }
        let port = CodexBacklogAsk(home: home.url, searchPath: "/usr/bin:/bin")

        let outcome = await port.answer("anything?", over: BacklogAskFixture.tickets)

        #expect(refusal(outcome) == .noSignIn(detail: "Codex is not signed in on this Mac"))
    }

    @Test
    func `a missing CLI refuses instead of asking`() async throws {
        let home = try TemporaryCodexHome(auth: TemporaryCodexHome.chatGPT)
        defer { home.remove() }
        let empty = try TemporaryCodexHome(auth: nil)
        defer { empty.remove() }
        let port = CodexBacklogAsk(home: home.url, searchPath: empty.url.path)

        let outcome = await port.answer("anything?", over: BacklogAskFixture.tickets)

        #expect(refusal(outcome) == .noCLI(detail: "Codex is not installed on this Mac"))
    }

    /// The sign-in is read BEFORE the CLI is located, so a machine with neither reports the one a
    /// reader can act on rather than whichever check happened to be written first.
    @Test
    func `a machine with neither reports the sign-in`() async throws {
        let home = try TemporaryCodexHome(auth: nil)
        defer { home.remove() }
        let port = CodexBacklogAsk(home: home.url, searchPath: "/nowhere")

        let outcome = await port.answer("anything?", over: BacklogAskFixture.tickets)

        #expect(refusal(outcome)?.sentence.contains("signed in") == true)
    }

    @Test
    func `every refusal states a sentence`() {
        let refusals: [BacklogAskRefusal] = [
            .noSignIn(detail: "no sign-in"), .noCLI(detail: "no CLI"),
            .timedOut(after: .seconds(25)), .refused(detail: "it said no"),
        ]

        for refusal in refusals {
            #expect(!refusal.sentence.isEmpty)
        }
    }

    @Test
    func `a timeout names the seconds waited`() {
        #expect(BacklogAskRefusal.timedOut(after: .seconds(25)).sentence.contains("25"))
    }

    private func refusal(
        _ outcome: Result<BacklogAnswer, BacklogAskRefusal>,
    )
        -> BacklogAskRefusal? {
        switch outcome {
        case .success: nil
        case let .failure(refusal): refusal
        }
    }
}
