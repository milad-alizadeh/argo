@testable import ArgoEngine
import Testing

/// What one Session has said over the companion channel, folded — and what survives the channel
/// closing. The report holds two kinds of fact and only one of them outlives the channel (#799).
struct CompanionReportTests {
    private let ask = CompanionAsk(id: "ask-1", question: "Which branch?", options: ["main"])
    private let outcome = CompanionOutcome(target: .code, reference: "abc123", summary: "landed")
    private let ready = CompanionReady(reason: "3 files, 2 commits")

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

    /// The channel carries a question in its own flat shape — one string and a list of labels —
    /// and the feed draws `Ask`. Read here so nothing downstream reinvents the conversion, and
    /// carried VERBATIM: an agent that asked in its own words is quoted, never reworded (#1205).
    @Test
    func `a reported question reads as one Ask, words and options verbatim`() {
        let read = ask.ask

        #expect(read.questions.count == 1)
        #expect(read.questions.first?.text == "Which branch?")
        #expect(read.questions.first?.options.map(\.label) == ["main"])
    }

    @Test
    func `a ready claim stands until something replaces it`() {
        var report = CompanionReport()
        report.apply(.ready(ready))

        #expect(report.readyToShip == ready)
    }

    /// The claim is about NOW, exactly as `status` is: an agent that reports what it is doing
    /// without repeating "ready" has moved past it.
    @Test
    func `a reported status retires a standing ready claim`() {
        var report = CompanionReport()
        report.apply(.ready(ready))
        report.apply(.status(.running))

        #expect(report.readyToShip == nil)
    }

    @Test
    func `a closed channel takes the ready claim with it`() {
        var report = CompanionReport()
        report.apply(.ready(ready))

        report.channelClosed()

        #expect(report.readyToShip == nil)
    }

    /// A question with nothing to choose from is a free-form ask, which the feed already draws —
    /// so no option is invented to stand in for the ones the agent did not offer.
    @Test
    func `a reported question that offered no options offers none`() {
        let free = CompanionAsk(id: "ask-2", question: "What next?", options: [])

        #expect(free.ask.questions.first?.options.isEmpty == true)
    }

    /// One answer at a time: the channel's shape has no `multiSelect`, and degrade-down resolves
    /// an unstated one to the narrower act.
    @Test
    func `a reported question takes one answer, nothing having said otherwise`() {
        #expect(ask.ask.questions.first?.allowsMultiple == false)
    }
}
