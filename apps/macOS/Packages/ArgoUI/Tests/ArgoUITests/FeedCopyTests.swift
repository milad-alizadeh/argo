@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the feed's copy affordance puts on the pasteboard (#734).
///
/// The markdown SOURCE and never the rendered glyphs: a drag-selection would hand over what the
/// screen drew, and this hands over what the agent wrote — the fence's own backticks included.
///
/// The Turn it copies is the one the lane draws a block beside, boundary for boundary, which is why
/// both read `TurnExtents` rather than each deciding. The two verbs there are different walks over
/// one rule, so the last case here holds them against each other.
@Suite("Feed copy")
struct FeedCopyTests {
    private static func asked(_ words: String) -> FeedRow.Content {
        .prompt(text: words, shots: [])
    }

    private static func said(_ words: String) -> FeedRow.Content {
        .message(words)
    }

    private static func thought(_ words: String) -> FeedRow.Content {
        .thought(words)
    }

    private static let ended = FeedRow.Content.mark(.turnEnded(.endTurn))

    private static func feed(_ contents: FeedRow.Content...) -> [FeedRow] {
        contents.enumerated().map { FeedRow(id: $0.offset, content: $0.element) }
    }

    @Test
    func `a row of prose copies its own source, verbatim`() {
        let fence = "Here it is:\n\n```swift\nlet x = 1\n```"
        #expect(FeedRow(id: 0, content: .message(fence)).kind.words == fence)
        #expect(FeedRow(id: 0, content: .prompt(text: "Fix the seam", shots: []))
            .kind.words == "Fix the seam")
        #expect(FeedRow(id: 0, content: .thought("Not sure yet.")).kind.words == "Not sure yet.")
    }

    /// A call, a mark and a question are not something somebody SAID, so there is nothing verbatim
    /// to hand over — and a rendered stand-in for one would be Argo's words, not the record's.
    @Test
    func `a row that is not prose offers nothing of its own`() {
        #expect(FeedRow(id: 0, content: Self.ended).kind.words == nil)
        #expect(FeedRow(id: 0, content: .mark(.compacted)).kind.words == nil)
    }

    @Test
    func `each kind of prose names itself in the menu`() {
        #expect(FeedRow(id: 0, content: .prompt(text: "x", shots: [])).kind
            .copyLabel == "Copy Prompt")
        #expect(FeedRow(id: 0, content: .message("x")).kind.copyLabel == "Copy Message")
        #expect(FeedRow(id: 0, content: .thought("x")).kind.copyLabel == "Copy Thought")
        #expect(FeedRow(id: 0, content: Self.ended).kind.copyLabel == nil)
    }

    @Test
    func `copying the Turn takes every word of it, in reading order`() {
        let rows = Self.feed(
            Self.asked("Fix the seam"),
            Self.thought("The handle moves with the value."),
            Self.said("Done."),
        )

        #expect(FeedCopy.turn(of: rows, holding: 1) == """
        Fix the seam

        The handle moves with the value.

        Done.
        """)
    }

    /// The row right-clicked decides WHICH Turn, and every row of that Turn answers with the same
    /// text — the affordance is about the Turn, not about where in it the pointer was.
    @Test
    func `every row of a Turn copies the same Turn`() {
        let rows = Self.feed(Self.asked("First"), Self.said("One."), Self.asked("Second"))
        let inside = rows.indices.prefix(2).map { FeedCopy.turn(of: rows, holding: $0) }

        #expect(inside == ["First\n\nOne.", "First\n\nOne."])
        #expect(FeedCopy.turn(of: rows, holding: 2) == "Second")
    }

    /// The work is left out rather than narrated: `Read 3 files` is a line Argo composed, and a
    /// paste that mixed it in with the agent's own words would not say which was which.
    @Test
    func `the Turn's work is left out, and the punctuation with it`() {
        let rows = Self.feed(
            Self.asked("Ship it"),
            .call(RowKindFixture.answeredCall),
            Self.said("Shipped."),
            Self.ended,
        )

        #expect(FeedCopy.turn(of: rows, holding: 3) == "Ship it\n\nShipped.")
    }

    @Test
    func `a Turn nobody said anything in copies nothing at all`() {
        let rows = Self.feed(
            .call(RowKindFixture.answeredCall),
            Self.ended,
        )

        #expect(FeedCopy.turn(of: rows, holding: 0) == nil)
    }

    @Test
    func `a row outside the reading copies nothing`() {
        #expect(FeedCopy.turn(of: [], holding: 0) == nil)
        #expect(FeedCopy.turn(of: Self.feed(Self.said("Only one.")), holding: 4) == nil)
    }

    /// Copy Turn walks outwards from one row and the lane sweeps the whole reading. Over a feed
    /// holding every boundary there is, the two have to name the same stretch for every row in it —
    /// a Turn the reader is handed that is not the Turn the lane drew is the bug this pair
    /// prevents.
    @Test
    func `the walk from a row lands on the span the whole sweep gives it`() {
        let rows = Self.feed(
            Self.said("Resumed mid-conversation."),
            Self.ended,
            Self.asked("First"),
            Self.said("One."),
            Self.asked("Second"),
            Self.thought("Weighing."),
            Self.said("Two."),
            Self.ended,
            Self.ended,
            Self.asked("Third"),
        )
        let reading = TurnExtents.Reading(
            count: rows.count,
            opensTurn: { rows[$0].kind.isPrompt },
            endsTurn: { rows[$0].content.kind.endsTurn },
        )
        let swept = TurnExtents.spans(of: reading)

        for row in rows.indices {
            #expect(TurnExtents.span(holding: row, of: reading)
                == swept.first { $0.contains(row) })
        }
    }
}
