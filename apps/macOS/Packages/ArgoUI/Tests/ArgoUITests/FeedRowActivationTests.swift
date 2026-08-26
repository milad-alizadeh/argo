import ArgoEngine
@testable import ArgoUI
import Testing

/// What a press on a row does, and the punctuation the reading is cut by. Both come off the same
/// switch as the row's flags, so a kind that resolves the wrong intent is wrong for Return, for
/// Space and for the click all at once.
@Suite("Feed row activation")
struct FeedRowActivationTests {
    /// A row with something to hide has a fold, and the key that works it is the fold's own.
    @Test(arguments: [
        FeedRow.Content.prompt(text: "Rename the deck", shots: []),
        .unreadable(FeedUnreadable(lines: ["{"])),
    ])
    func `a row with a fold folds`(content: FeedRow.Content) {
        #expect(content.kind.activation == .fold)
    }

    /// One rule for pointer and keyboard: the three kinds that draw a disclosure marker are exactly
    /// the three whose press goes to the panel. Whether there is anything BEHIND it is
    /// `opensEvidence`, asked separately, so a call the record never answered still means the panel
    /// rather than meaning nothing.
    @Test(arguments: [
        FeedRow.Content.call(RowKindFixture.pendingCall),
        .survey(RowKindFixture.survey),
        .skillLoaded(RowKindFixture.skill),
    ])
    func `a row the panel stands behind opens the panel`(content: FeedRow.Content) {
        #expect(content.kind.activation == .openEvidence)
    }

    /// A gallery opens the FIRST picture there is anything behind — its shots are each a control of
    /// their own — and a prompt that is only a picture gives the same answer on the row the picture
    /// arrived in.
    @Test
    func `a row of pictures opens the first one there is anything behind`() {
        let shots = [RowKindFixture.absentShot, RowKindFixture.openableShot]
        let opened = FeedRow.Content.Kind.Activation.light(RowKindFixture.openableShot)

        #expect(FeedRow.Content.gallery(FeedGallery(shots: shots)).kind.activation == opened)
        #expect(FeedRow.Content.prompt(text: "", shots: shots).kind.activation == opened)
    }

    /// Nothing to fold and nothing to light, so the key falls through to the feed rather than being
    /// swallowed by a row that does nothing — a gallery of absences and a picture-only prompt whose
    /// picture never arrived included.
    @Test(arguments: [
        FeedRow.Content.message("Renamed."),
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

    /// A fact about the READING rather than about the row, and answered by the same switch as the
    /// rest: the overview lane's blocks and the feed's Copy turn are both cut by it.
    @Test
    func `only a stop reason and an interruption end a Turn`() {
        let marks: [FeedMark] = [.turnEnded(.endTurn), .interrupted, .compacted, .working]

        #expect(marks.map { FeedRow.Content.mark($0).kind.endsTurn } == [true, true, false, false])
    }

    /// The one row the reading measure does not hold. Asked of the same switch as its siblings, so
    /// a second mark wanting the full width says so there rather than in an equality test of its
    /// own.
    @Test
    func `only the working mark is the working thread`() {
        let kinds = RowKindFixture.everyKind + [.mark(.working)]

        #expect(kinds.filter(\.kind.isWorkingThread) == [.mark(.working)])
    }

    /// Two kinds hold pictures — a call's gallery, and the prompt somebody pasted one into (#733) —
    /// which is how the lightbox finds the row to hand the keyboard back to.
    @Test
    func `only a gallery and a prompt hold pictures`() {
        let shot = RowKindFixture.openableShot
        let holders: [FeedRow.Content] = [
            .gallery(FeedGallery(shots: [shot])),
            .prompt(text: "Look", shots: [shot]),
        ]

        #expect(holders.allSatisfy { $0.kind.shots == [shot] })
        #expect(
            RowKindFixture.everyKind.filter { !$0.kind.shots.isEmpty }
                == [.gallery(RowKindFixture.gallery)],
        )
    }
}
