@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The offer drawn ON the reading (#767).
///
/// One Turn draws ONE chip, at the foot of the last message in it, and it hands over every message
/// of that Turn.
@Suite("Feed prose copy")
struct FeedProseCopyTests {
    private static let fence = "Here it is:\n\n```swift\nlet x = 1\n```"

    private static func feed(_ contents: FeedRow.Content...) -> [FeedRow] {
        contents.enumerated().map { FeedRow(id: $0.offset, content: $0.element) }
    }

    private static func offers(_ rows: [FeedRow]) -> [Int: FeedRow.CopyOffer] {
        rows.indices.reduce(into: [:]) { found, index in
            found[index] = FeedCopy.chipOffer(of: rows, at: index)
        }
    }

    @Test
    func `a Turn offers its answer once, on the last thing the agent said`() {
        let rows = Self.feed(
            .prompt(text: "Fix the seam", shots: []),
            .thought("The handle moves with the value."),
            .message("Found it."),
            .call(RowKindFixture.answeredCall),
            .message(Self.fence),
            .mark(.turnEnded(.endTurn)),
        )

        #expect(Self.offers(rows) == [4: .init(
            words: "Found it.\n\n" + Self.fence,
            label: "Copy Messages",
        )])
    }

    /// The reader wrote the prompt and the Turn routinely contradicts its own reasoning, so neither
    /// belongs in the answer a chip hands over.
    @Test
    func `a Turn with nothing said draws no chip`() {
        let rows = Self.feed(
            .prompt(text: "Fix the seam", shots: []),
            .thought("Weighing it."),
            .mark(.turnEnded(.endTurn)),
        )

        #expect(Self.offers(rows).isEmpty)
    }

    /// Each Turn answers for itself: the chip belongs to the answer it stands at the foot of.
    @Test
    func `two Turns draw one chip each, over their own words`() {
        let rows = Self.feed(
            .prompt(text: "First", shots: []),
            .message("One."),
            .prompt(text: "Second", shots: []),
            .message("Two."),
        )

        #expect(Self.offers(rows) == [
            1: .init(words: "One.", label: "Copy Messages"),
            3: .init(words: "Two.", label: "Copy Messages"),
        ])
    }

    /// The chip moves as a Turn grows: it belongs to the last message there IS, so the message
    /// that had it gives it up when another arrives. `FeedTableDelta` is what re-asks the row it
    /// left.
    @Test
    func `a message arriving later takes the chip off the one that had it`() {
        let opening = Self.feed(.prompt(text: "Fix the seam", shots: []), .message("Found it."))
        let grown = Self.feed(
            .prompt(text: "Fix the seam", shots: []),
            .message("Found it."),
            .call(RowKindFixture.answeredCall),
            .message("Fixed."),
        )

        #expect(Self.offers(opening).keys.sorted() == [1])
        #expect(Self.offers(grown).keys.sorted() == [3])
    }

    @Test
    func `a row outside the reading offers nothing`() {
        #expect(FeedCopy.chipOffer(of: Self.feed(.message("One.")), at: 4) == nil)
    }
}
