import ArgoEngine
@testable import ArgoUI
import Testing

/// What a press on a row does, and the punctuation the reading is cut by. Both come off the same
/// switch as the row's flags, so a wrong intent is wrong for Return, for Space and for the click.
@Suite("Feed row activation")
struct FeedRowActivationTests {
    /// A row with something to hide has a fold, and the key that works it is the fold's own. A
    /// fold of calls is one of them: the press lists what it took, and the panel belongs to a name
    /// in that list rather than to the count over it.
    @Test(arguments: [
        FeedRow.Content.prompt(text: "Rename the deck", shots: []),
        .unreadable(FeedUnreadable(lines: ["{"])),
        .survey(RowKindFixture.survey),
        .work(RowKindFixture.work),
    ])
    func `a row with a fold folds`(content: FeedRow.Content) {
        #expect(content.kind.activation == .fold)
    }

    /// Whether there is anything BEHIND the panel is `opensEvidence`, asked separately, so a call
    /// the record never answered still means the panel rather than meaning nothing.
    @Test(arguments: [
        FeedRow.Content.call(RowKindFixture.pendingCall),
        .skillLoaded(RowKindFixture.skill),
    ])
    func `a row the panel stands behind opens the panel`(content: FeedRow.Content) {
        #expect(content.kind.activation == .openEvidence)
    }

    /// The first picture, not the first shot: a shot the record kept no bytes for opens nothing, so
    /// a press would land on an empty lightbox.
    @Test(arguments: [
        FeedRow.Content.gallery(FeedGallery(shots: RowKindFixture.anAbsenceThenAPicture)),
        .prompt(text: "", shots: RowKindFixture.anAbsenceThenAPicture),
    ])
    func `a row of pictures opens the first one there is anything behind`(
        content: FeedRow.Content,
    ) {
        let opened = FeedRow.Content.Kind.Activation.light(RowKindFixture.openableShot)

        #expect(content.kind.activation == opened)
    }

    /// Nothing to fold and nothing to light, so the key falls through to the feed rather than being
    /// swallowed by a row that does nothing. A fold the record answered with nothing is one of
    /// them: there is no list to put out, and the drawn line offers no click either.
    @Test(arguments: [
        FeedRow.Content.message("Renamed."),
        .survey(FeedSurvey(calls: [RowKindFixture.pendingCall, RowKindFixture.pendingCall])),
        .thought("Weighing."),
        .ask(RowKindFixture.ask),
        .mark(.compacted),
        .gallery(RowKindFixture.gallery),
        .prompt(text: "", shots: [RowKindFixture.absentShot]),
        .prompt(text: "", shots: []),
    ])
    func `a row with nothing to open is inert`(content: FeedRow.Content) {
        #expect(content.kind.activation == .inert)
    }

    /// A fact about the READING rather than about the row: the overview lane's blocks and the
    /// feed's Copy turn are both cut by it.
    @Test
    func `only the two marks that finish a Turn end one`() {
        let marks: [FeedMark] = [.turnEnded, .interrupted, .compacted, .working]

        #expect(marks.map { FeedRow.Content.mark($0).kind.endsTurn } == [true, true, false, false])
    }

    /// The one row the reading measure does not hold — its ion sweeps the zone's full width.
    @Test
    func `only the working mark is the working thread`() {
        let kinds = RowKindFixture.everyKind + [.mark(.working)]

        #expect(kinds.filter(\.kind.isWorkingThread) == [.mark(.working)])
    }

    /// How the lightbox finds the row to hand the keyboard back to: a call's gallery, and the
    /// prompt somebody pasted a picture into (#733).
    @Test(arguments: [
        FeedRow.Content.gallery(FeedGallery(shots: [RowKindFixture.openableShot])),
        .prompt(text: "Look", shots: [RowKindFixture.openableShot]),
    ])
    func `a row holding pictures answers with them`(content: FeedRow.Content) {
        #expect(content.kind.shots == [RowKindFixture.openableShot])
    }

    @Test
    func `no other kind holds a picture`() {
        let holders = RowKindFixture.everyKind.filter { !$0.kind.shots.isEmpty }

        #expect(holders == [.gallery(RowKindFixture.gallery)])
    }
}
