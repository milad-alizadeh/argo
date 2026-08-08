import ArgoEngine
@testable import ArgoUI
import Testing

/// What the plan is, read off a stream that also carries everything else.
///
/// The claims here are all one claim said four ways: the plan is STANDING STATE and not an event
/// (ADR-0020). A projection that treated it as an event would blank the pill on every turn that
/// did not mention it, and a reader would learn to stop trusting what it says.
@Suite("Plan projection")
struct PlanProjectionTests {
    private func plan(_ entries: (String, PlanEntryStatus)...) -> TranscriptEvent {
        .plan(Plan(entries: entries.map { PlanEntry(text: $0.0, status: $0.1) }))
    }

    @Test
    func `the newest list the record carries replaces the previous one whole`() {
        let reading = PlanProjection.reading(from: [
            plan(("Read the study", .inProgress), ("Draw the three kinds", .pending)),
            plan(("Land the metrics", .completed), ("Ship the pill", .inProgress)),
        ])

        // Not merged, not patched: the second list IS the plan, and nothing of the first survives.
        #expect(reading?.steps.map(\.text) == ["Land the metrics", "Ship the pill"])
    }

    @Test
    func `a turn that touched no plan leaves the last one observed standing`() {
        let reading = PlanProjection.reading(from: [
            plan(("Land the metrics", .inProgress)),
            .message(markdown: "Landed."),
            .turnEnded(.endTurn),
            .prompt(text: "Now the pill.", atMs: 1000),
            .message(markdown: "Working on it."),
        ])

        #expect(reading?.steps.map(\.text) == ["Land the metrics"])
    }

    @Test
    func `a Session that never reported a plan has no reading at all`() {
        let reading = PlanProjection.reading(from: [
            .prompt(text: "Read the study.", atMs: 1000),
            .message(markdown: "Read it."),
            .thought(markdown: "The measure is typographic."),
        ])

        #expect(reading == nil)
    }

    /// An agent that replaced its list with an empty one has no steps to show, and a pill reading
    /// `0 steps` would be chrome standing for nothing.
    @Test
    func `a plan the agent emptied reads the same as one never reported`() {
        #expect(PlanProjection.reading(from: [plan()]) == nil)
    }

    @Test
    func `the step in progress is named with its place in the list`() {
        let reading = PlanProjection.reading(from: [
            plan(
                ("Read the study", .completed),
                ("Run the suite red", .inProgress),
                ("Implement the seam", .pending),
                ("Review, then PR", .pending),
            ),
        ])

        #expect(reading?.current?.text == "Run the suite red")
        #expect(reading?.position == 2)
        #expect(reading?.count == 4)
    }

    /// The honest answer to "what is it doing" when the list does not say is nothing — never the
    /// first pending entry, which is the agent's NEXT step and not its current one.
    @Test
    func `a plan with nothing in progress names no current step`() {
        let reading = PlanProjection.reading(from: [
            plan(("Read the study", .completed), ("Run the suite red", .pending)),
        ])

        #expect(reading?.current == nil)
        #expect(reading?.position == nil)
        #expect(reading?.completed == 1)
    }

    @Test
    func `a plan the agent finished names no current step either`() {
        let reading = PlanProjection.reading(from: [
            plan(("Read the study", .completed), ("Ship it", .completed)),
        ])

        #expect(reading?.current == nil)
        #expect(reading?.progress == 1)
    }

    /// A list is replaced whole, so a step is WHERE it sits and never what it says. Two entries
    /// worded the same are two steps, and a reading keyed by text would fuse them.
    @Test
    func `two steps worded the same stay two steps`() {
        let reading = PlanProjection.reading(from: [
            plan(("Run the suite", .completed), ("Run the suite", .pending)),
        ])

        #expect(reading?.steps.map(\.id) == [0, 1])
    }

    /// A plan marking two — which a careless agent does — is still read as being on ONE step. The
    /// first, because that is the one the list reaches first, and counting them would answer a
    /// question the pill does not ask.
    @Test
    func `a list marking two in progress reads the first of them`() {
        let reading = PlanProjection.reading(from: [
            plan(("First", .inProgress), ("Second", .inProgress)),
        ])

        #expect(reading?.position == 1)
    }

    @Test
    func `how far the plan has got is counted off what it marks completed`() {
        let reading = PlanProjection.reading(from: [
            plan(
                ("One", .completed),
                ("Two", .completed),
                ("Three", .inProgress),
                ("Four", .pending),
            ),
        ])

        #expect(reading?.progress == 0.5)
    }

    /// The pill and the feed read the same stream and must not both draw the plan.
    @Test
    func `the plan the pill reads is not in the feed's rows`() {
        let events = [plan(("Land the metrics", .inProgress)), .message(markdown: "Landed.")]

        #expect(PlanProjection.reading(from: events) != nil)
        #expect(FeedProjection.rows(from: events).map(\.content) == [.message("Landed.")])
    }
}
