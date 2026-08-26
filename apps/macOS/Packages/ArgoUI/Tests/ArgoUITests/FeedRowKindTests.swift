import ArgoEngine
@testable import ArgoUI
import Testing

/// What each kind of row IS. The feed's spacing, its two filtered renders, the accent on a
/// just-sent echo, the working thread, the Turn punctuation, the lightbox and the evidence panel
/// all act on one of these answers, so a kind that answers wrong is wrong everywhere at once.
/// What a PRESS on the row does is the same switch, covered in `FeedRowActivationTests`.
@Suite("Feed row kind")
struct FeedRowKindTests {
    /// Work and prose are the two halves the feed spaces differently, so nothing may be both.
    @Test(arguments: RowKindFixture.everyKind)
    func `no row is both a piece of work and a piece of prose`(content: FeedRow.Content) {
        let kind = content.kind

        #expect(!(kind.isCall && kind.isProse))
    }

    /// A prompt and a message are the two things somebody said; a thought is reasoning, and prose
    /// as well. Nothing else is.
    @Test
    func `only the three spoken kinds are prose`() {
        let prose = RowKindFixture.everyKind.filter(\.kind.isProse)

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
        let kind = FeedRow.Content.thought("Weighing.").kind

        #expect(kind.isProse)
        #expect(!kind.isMessage)
    }

    /// What the accent wash on a just-sent echo is read off.
    @Test
    func `only what the user asked for is a prompt`() {
        let prompts = RowKindFixture.everyKind.filter(\.kind.isPrompt)

        #expect(prompts == [.prompt(text: "Rename the deck", shots: [])])
    }

    /// A survey and a gallery are counts and pictures rather than lines, but the feed welds all
    /// three into one run.
    @Test
    func `every shape a piece of looking takes is work`() {
        let work = RowKindFixture.everyKind.filter(\.kind.isCall)

        #expect(work == [
            .call(RowKindFixture.answeredCall),
            .call(RowKindFixture.pendingCall),
            .survey(RowKindFixture.survey),
            .gallery(RowKindFixture.gallery),
        ])
    }

    /// Punctuation is neither: a question, a compaction mark and a line nothing could parse take
    /// the full step prose gets without being prose.
    @Test(arguments: [
        FeedRow.Content.ask(RowKindFixture.ask),
        .mark(.compacted),
        .unreadable(FeedUnreadable(lines: ["{"])),
    ])
    func `punctuation is neither work nor prose`(content: FeedRow.Content) {
        let kind = content.kind

        #expect(!kind.isCall)
        #expect(!kind.isProse)
    }

    /// The ion crosses exactly one row, and only a call can be the row it crosses.
    @Test
    func `only a call the record has not answered is in flight`() {
        let inFlight = RowKindFixture.everyKind.filter(\.kind.isCallInFlight)

        #expect(inFlight == [.call(RowKindFixture.pendingCall)])
    }

    /// A folded run keeps the run pending while any call in it is — but the ROW standing for it
    /// draws no ion, so the working thread is what stands over it.
    @Test
    func `a folded run holding a pending call still draws no ion`() {
        let survey = FeedSurvey(calls: [RowKindFixture.pendingCall])

        #expect(!FeedRow.Content.survey(survey).kind.isCallInFlight)
    }

    /// One rule for pointer and keyboard: a row that draws no disclosure marker must not open on
    /// Return either.
    @Test
    func `a call opens the panel exactly when the record answered it with something`() {
        #expect(FeedRow.Content.call(RowKindFixture.answeredCall).kind.opensEvidence)
        #expect(!FeedRow.Content.call(RowKindFixture.pendingCall).kind.opensEvidence)
    }

    @Test
    func `a folded run opens the panel exactly when one of its calls carries evidence`() {
        let answered = FeedSurvey(calls: [RowKindFixture.pendingCall, RowKindFixture.answeredCall])
        let empty = FeedSurvey(calls: [RowKindFixture.pendingCall])

        #expect(FeedRow.Content.survey(answered).kind.opensEvidence)
        #expect(!FeedRow.Content.survey(empty).kind.opensEvidence)
    }

    /// What a shot produced IS the shot, so the click goes to the picture and never to the panel.
    @Test
    func `a gallery opens no evidence panel`() {
        #expect(!FeedRow.Content.gallery(RowKindFixture.gallery).kind.opensEvidence)
    }

    /// A row that cannot be clicked into the panel carries nothing for it, which is what keeps a
    /// stale `open` id from resolving to somebody else's evidence.
    @Test
    func `only the rows the panel stands behind carry anything for it`() {
        let opened = RowKindFixture.everyKind.filter { $0.opened != nil }

        #expect(opened == [
            .call(RowKindFixture.answeredCall),
            .call(RowKindFixture.pendingCall),
            .survey(RowKindFixture.survey),
            .skillLoaded(RowKindFixture.skill),
        ])
    }

    /// The minimap's prompt band reads `words` off `isPrompt` alone, so the two may never disagree.
    @Test(arguments: RowKindFixture.everyKind
        + [.prompt(text: "", shots: [RowKindFixture.openableShot])])
    func `a prompt always carries the words the lane draws`(content: FeedRow.Content) {
        let kind = content.kind

        #expect(!kind.isPrompt || kind.words != nil)
    }

    /// The reading grows under an open panel, so the evidence is re-resolved every update — it has
    /// to be the CURRENT call's, not a copy taken when the row was clicked.
    @Test
    func `the evidence a call carries is its own results`() throws {
        let opened = try #require(FeedRow.Content.call(RowKindFixture.answeredCall).opened)

        #expect(opened == RowKindFixture.answeredCall.opened)
    }
}
