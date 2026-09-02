@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// How much the agent SAID since the reader left the end, over rows alone. Never looks at a pane —
/// `FeedTailTests` is the geometry and scroll-phase half of the same control.
@Suite("New messages since the reader left the end")
struct FeedNewMessagesTests {
    /// One call, so the reading has work in it. Plain rather than a filename: what it NAMED is
    /// nothing this rule reads.
    private static let work = FeedCall(
        kind: .read,
        subject: .plain("something"),
        churn: nil,
        ending: .succeeded,
        evidence: [],
        repeats: 1,
        spend: nil,
    )

    /// A reading with every kind the feed can draw in it, and three things said across it. The
    /// kinds between the messages each move the feed without moving the number.
    private static let reading = numbered([
        .message("Said before the reader ever left"),
        .mark(.compacted),
        .call(work),
        .survey(FeedSurvey(calls: [work])),
        .gallery(FeedGallery(shots: [])),
        .message("First thing said since"),
        .prompt(text: "A steer typed mid-run", shots: []),
        .thought("Reasoning, which is not a message"),
        .unreadable(FeedUnreadable(lines: ["{\"partial\":"])),
        .message("Second thing said since"),
    ])

    /// One anchor and what it is worth. The anchor is the last row present when following broke,
    /// so what is counted is everything SAID below it, its own row excluded.
    struct Leaving {
        let since: FeedRow.ID
        let count: Int
        /// What this row is a case OF, printed on a failure.
        let when: String
    }

    @Test(arguments: [
        Leaving(since: 1, count: 2, when: "a mark above everything said since"),
        Leaving(since: 0, count: 2, when: "a message, not counted as one of its own successors"),
        Leaving(since: 5, count: 1, when: "the reader left a second time, further down"),
        Leaving(since: 9, count: 0, when: "the newest message"),
    ])
    func `only what was said below the anchor is counted`(row: Leaving) {
        #expect(
            FeedTail.newMessages(in: Self.reading, since: row.since) == row.count,
            "\(row.when)",
        )
    }

    /// What a Session switch leaves behind: a count taken from a place not in the record would
    /// attribute this reading's prose to somewhere the reader never stood.
    @Test
    func `an anchor the reading does not hold counts nothing`() {
        #expect(FeedTail.newMessages(in: Self.reading, since: Self.reading.count + 1) == 0)
    }

    @Test
    func `a reading with no rows in it counts nothing`() {
        #expect(FeedTail.newMessages(in: [], since: 0) == 0)
    }

    /// The two rendered states, held to what their cases claim they are. Every way they can rot is
    /// silent — a PNG of either failure looks exactly like a PNG of the state working.
    @Test
    func `the rendered cases carry the counts they are cases of`() throws {
        let held = try #require(FeedProjection.longHeldRowID)
        #expect(FeedTail.newMessages(in: FeedProjection.longRows, since: held) == 6)
        #expect(FeedTail.newMessages(in: FeedProjection.longSilentRows, since: held) == 0)
    }

    /// With less than a pane below the anchor the scroll clamps to the end, the feed latches back
    /// onto following, and the render comes out as no control at all — a different claim from a
    /// control with no badge on it.
    @Test
    func `the silent case still runs well past where the reader stopped`() throws {
        let held = try #require(FeedProjection.longHeldRowID)
        let rows = FeedProjection.longSilentRows
        let at = try #require(rows.firstIndex { $0.id == held })
        #expect(rows.count - at > Self.aPaneOfRows)
    }

    /// Comfortably more rows than the deck can show at once — a count rather than a height because
    /// no test here has a pane, generous so it does not fail on a taller display.
    private static let aPaneOfRows = 25

    /// Rows in their places, dense over the rows, so the ids a test names are the ids a reading
    /// has.
    private static func numbered(_ contents: [FeedRow.Content]) -> [FeedRow] {
        contents.enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }
}
