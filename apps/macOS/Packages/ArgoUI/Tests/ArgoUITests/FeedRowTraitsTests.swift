import ArgoEngine
@testable import ArgoUI
import Testing

/// What each kind of row IS. The feed's spacing, its two filtered renders, the accent on a
/// just-sent echo, the working thread and the evidence panel each act on one of these answers, so
/// a kind that answers wrong is wrong in five places at once.
@Suite("Feed row traits")
struct FeedRowTraitsTests {
    /// Work and prose are the two halves the feed spaces differently, so nothing may be both.
    @Test(arguments: TraitFixture.everyKind)
    func `no row is both a piece of work and a piece of prose`(content: FeedRow.Content) {
        let traits = content.traits

        #expect(!(traits.isCall && traits.isProse))
    }

    /// A prompt and a message are the two things somebody said; a thought is reasoning, and prose
    /// as well. Nothing else is.
    @Test
    func `only the three spoken kinds are prose`() {
        let prose = TraitFixture.everyKind.filter(\.traits.isProse)

        #expect(prose == [
            .prompt(text: "Rename the deck", shots: []),
            .message("Renamed."),
            .thought("Weighing."),
        ])
    }

    /// Narrower than prose on purpose: a Turn's final message routinely contradicts its own
    /// reasoning, so counting a thought would promise two answers where the agent gave one.
    @Test
    func `a thought is prose but not something the agent said`() {
        let traits = FeedRow.Content.thought("Weighing.").traits

        #expect(traits.isProse)
        #expect(!traits.isMessage)
    }

    /// What the accent wash on a just-sent echo is read off.
    @Test
    func `only what the user asked for is a prompt`() {
        let prompts = TraitFixture.everyKind.filter(\.traits.isPrompt)

        #expect(prompts == [.prompt(text: "Rename the deck", shots: [])])
    }

    /// A survey and a gallery are counts and pictures rather than lines, but the feed welds all
    /// three into one run.
    @Test
    func `a call, a folded run of looking and a gallery are all work`() {
        let work = TraitFixture.everyKind.filter(\.traits.isCall)

        #expect(work == [
            .call(TraitFixture.answeredCall),
            .call(TraitFixture.pendingCall),
            .survey(TraitFixture.survey),
            .gallery(TraitFixture.gallery),
        ])
    }

    /// Punctuation is neither: a question, a compaction mark and a line nothing could parse take
    /// the full step prose gets without being prose.
    @Test(arguments: [
        FeedRow.Content.ask(TraitFixture.ask),
        .mark(.compacted),
        .unreadable(FeedUnreadable(lines: ["{"])),
    ])
    func `punctuation is neither work nor prose`(content: FeedRow.Content) {
        let traits = content.traits

        #expect(!traits.isCall)
        #expect(!traits.isProse)
    }

    /// The ion crosses exactly one row, and only a call can be the row it crosses.
    @Test
    func `only a call the record has not answered is in flight`() {
        let inFlight = TraitFixture.everyKind.filter(\.traits.isCallInFlight)

        #expect(inFlight == [.call(TraitFixture.pendingCall)])
    }

    /// A folded run keeps the run pending while any call in it is — but the ROW standing for it
    /// draws no ion, so the working thread is what stands over it.
    @Test
    func `a folded run holding a pending call still draws no ion`() {
        let survey = FeedSurvey(calls: [TraitFixture.pendingCall])

        #expect(!FeedRow.Content.survey(survey).traits.isCallInFlight)
    }

    /// One rule for pointer and keyboard: a row that draws no disclosure marker must not open on
    /// Return either.
    @Test
    func `a call opens the panel exactly when the record answered it with something`() {
        #expect(FeedRow.Content.call(TraitFixture.answeredCall).traits.opensEvidence)
        #expect(!FeedRow.Content.call(TraitFixture.pendingCall).traits.opensEvidence)
    }

    @Test
    func `a folded run opens the panel exactly when one of its calls carries evidence`() {
        let answered = FeedSurvey(calls: [TraitFixture.pendingCall, TraitFixture.answeredCall])
        let empty = FeedSurvey(calls: [TraitFixture.pendingCall])

        #expect(FeedRow.Content.survey(answered).traits.opensEvidence)
        #expect(!FeedRow.Content.survey(empty).traits.opensEvidence)
    }

    /// What a shot produced IS the shot, so the click goes to the picture and never to the panel.
    @Test
    func `a gallery opens no evidence panel`() {
        #expect(!FeedRow.Content.gallery(TraitFixture.gallery).traits.opensEvidence)
    }

    /// The panel's content comes off the row's own payload. A row that cannot be clicked into the
    /// panel carries none, which is what keeps a stale `open` id from resolving to somebody
    /// else's evidence.
    @Test
    func `only a call or a folded run carries anything for the panel`() {
        let opened = TraitFixture.everyKind.filter { $0.opened != nil }

        #expect(opened == [
            .call(TraitFixture.answeredCall),
            .call(TraitFixture.pendingCall),
            .survey(TraitFixture.survey),
        ])
    }

    /// The reading grows under an open panel, so the evidence is re-resolved every update — it has
    /// to be the CURRENT call's, not a copy taken when the row was clicked.
    @Test
    func `the evidence a call carries is its own results`() throws {
        let opened = try #require(FeedRow.Content.call(TraitFixture.answeredCall).opened)

        #expect(opened == TraitFixture.answeredCall.opened)
    }
}

/// One row of every kind the feed can produce. Hand-listed rather than derived: `FeedRow.Content`
/// has no case list to walk, and the exhaustive `switch` behind `traits` is what actually fails a
/// build when a tenth kind arrives.
enum TraitFixture {
    static let everyKind: [FeedRow.Content] = [
        .prompt(text: "Rename the deck", shots: []),
        .message("Renamed."),
        .thought("Weighing."),
        .call(answeredCall),
        .call(pendingCall),
        .survey(survey),
        .gallery(gallery),
        .ask(ask),
        .mark(.compacted),
        .unreadable(FeedUnreadable(lines: ["{"])),
    ]

    /// A call the record answered with output — the one that opens the panel.
    static let answeredCall = call(evidence: [
        .output(OutputEvidence(tier: .direct, text: "ok")),
    ], ending: .succeeded)

    /// A call the transcript has not answered yet. It carries no evidence for the same reason: the
    /// result has not been written.
    static let pendingCall = call(evidence: [], ending: .pending)

    static let survey = FeedSurvey(calls: [answeredCall])

    static let gallery = FeedGallery(shots: [
        FeedShot(
            name: "shot.png",
            address: "/tmp/shot.png",
            media: MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil),
        ),
    ])

    static let ask = FeedAsk(ask: Ask(questions: []), isAnswered: false, answer: nil)

    private static func call(
        evidence: [ToolResult],
        ending: FeedCall.Ending,
    )
        -> FeedCall {
        FeedCall(
            kind: .read,
            subject: .plain("Package.swift"),
            churn: nil,
            ending: ending,
            evidence: evidence,
            repeats: 1,
            spend: nil,
        )
    }
}
