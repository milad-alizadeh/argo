@testable import ArgoEngine
import Testing

/// What one Session has said over the companion channel, folded — and what survives the channel
/// closing. The report holds two kinds of fact and only one of them outlives the channel (#799).
struct CompanionReportTests {
    private let ask = CompanionAsk(id: "ask-1", question: "Which branch?", options: ["main"])
    private let outcome = CompanionOutcome(target: .code, reference: "abc123", summary: "landed")

    @Test
    func `a status replaces the one before it, being a claim about now`() {
        var report = CompanionReport()
        report.apply(.status(.running))
        report.apply(.status(.idle))

        #expect(report.status == .idle)
    }

    @Test
    func `outcomes accumulate, being what got done`() {
        var report = CompanionReport()
        report.apply(.outcome(outcome))
        report.apply(.outcome(outcome))

        #expect(report.outcomes.count == 2)
    }

    /// The status stood on the channel: nothing behind it can still be true once the channel is
    /// gone, and a Session left reading `running` is a claim Argo cannot establish.
    @Test
    func `a closed channel takes the reported status with it`() {
        var report = CompanionReport()
        report.apply(.status(.running))

        report.channelClosed()

        #expect(report.status == nil)
    }

    @Test
    func `a closed channel takes the unanswered question with it`() {
        var report = CompanionReport()
        report.apply(.ask(ask))

        report.channelClosed()

        #expect(report.pendingAsk == nil)
    }

    /// What the agent produced happened, and goes on having happened.
    @Test
    func `a closed channel leaves the outcomes standing`() {
        var report = CompanionReport()
        report.apply(.status(.running))
        report.apply(.outcome(outcome))

        report.channelClosed()

        #expect(report.outcomes == [outcome])
    }

    /// The claim leaves the ledger on the strength of this, so a report that said only what it is
    /// doing must read as empty once it can no longer be doing it.
    @Test
    func `a report of nothing but a status is empty once the channel closes`() {
        var report = CompanionReport()
        report.apply(.status(.running))

        report.channelClosed()

        #expect(report.isEmpty)
    }
}
