@testable import ArgoUI
import Testing

/// How much the agent SAID since the reader left the end, over rows alone.
///
/// Its own suite rather than another block in `FeedTailTests`, because it answers a different half
/// of the same control. That suite is geometry and scroll phases — where the reading is and whose
/// scroll put it there. This one never looks at a pane: it is a reading of the RECORD taken from a
/// place the reader marked, and the whole of it is a count over a list of rows.
@Suite("New messages since the reader left the end")
struct FeedNewMessagesTests {
    /// One call, so the reading has work in it. Plain rather than a filename: what it NAMED is
    /// nothing this rule reads, and a fixture that dressed it would be claiming otherwise.
    private static let work = FeedCall(
        kind: .read,
        subject: .plain("something"),
        churn: nil,
        ending: .succeeded,
        evidence: [],
        repeats: 1,
        spend: nil,
    )

    /// A reading with every kind the feed can draw in it, and three things said across it.
    ///
    /// The kinds between the messages are the point of the fixture: each is here to move the feed
    /// without moving the number. Why that is the rule is `FeedTail.newMessages`'s to say.
    private static let reading = numbered([
        .message("Said before the reader ever left"),
        .mark(.compacted),
        .call(work),
        .survey(FeedSurvey(calls: [work])),
        .gallery(FeedGallery(shots: [])),
        .message("First thing said since"),
        .prompt("A steer typed mid-run"),
        .thought("Reasoning, which is not a message"),
        .unreadable(FeedUnreadable(lines: ["{\"partial\":"])),
        .message("Second thing said since"),
    ])

    /// The anchor is the last row present when following broke, so what is counted is everything
    /// SAID below it — the anchor's own row included in neither reading of the word.
    ///
    /// The last two rows carry the claim that a badge is never a lie about a reading that has
    /// caught up: an anchor on the newest message counts nothing, and neither does one on the last
    /// row of all.
    /// One anchor and what it is worth. A named case rather than a tuple: three fields is where a
    /// positional row stops saying which number is the place and which is the count.
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

    /// An anchor naming no row in this reading. It is what a Session switch would leave behind, and
    /// the answer is the quiet one: a count taken from a place that is not in the record would be
    /// this reading's prose attributed to somewhere the reader never stood.
    @Test
    func `an anchor the reading does not hold counts nothing`() {
        #expect(FeedTail.newMessages(in: Self.reading, since: Self.reading.count + 1) == 0)
    }

    @Test
    func `a reading with no rows in it counts nothing`() {
        #expect(FeedTail.newMessages(in: [], since: 0) == 0)
    }

    /// The two rendered states, held to what their cases claim they are.
    ///
    /// A specimen is evidence, and both of these are derived from a fixture transcript that a later
    /// ticket will grow. Every way they can rot is silent: `leaving` returning `nil` renders an
    /// ordinary following feed, and a filter that missed a message renders a badge in the case that
    /// exists to show none. A PNG of either failure looks exactly like a PNG of the state working.
    @Test
    func `the rendered cases carry the counts they are cases of`() throws {
        let held = try #require(FeedProjection.longHeldRowID)
        #expect(FeedTail.newMessages(in: FeedProjection.longRows, since: held) == 6)
        #expect(FeedTail.newMessages(in: FeedProjection.longSilentRows, since: held) == 0)
    }

    /// And that the silent case is still a reading the reader has visibly LEFT, rather than the
    /// fixture cut off at the place they stopped. With less than a pane below the anchor the scroll
    /// clamps to the end, the feed latches back onto following, and the render comes out as no
    /// control at all — which is a different claim from a control with no badge on it.
    @Test
    func `the silent case still runs well past where the reader stopped`() throws {
        let held = try #require(FeedProjection.longHeldRowID)
        let rows = FeedProjection.longSilentRows
        let at = try #require(rows.firstIndex { $0.id == held })
        #expect(rows.count - at > Self.aPaneOfRows)
    }

    /// Comfortably more rows than the deck can show at once. A count rather than a height because
    /// no test here has a pane: what it is standing in for is "the reader cannot see the end from
    /// where they are", and being generous is what keeps it from failing on a taller display.
    private static let aPaneOfRows = 25

    /// Rows in their places, the way the projection gives them out — dense over the rows, so the
    /// ids a test names are the ids a reading has.
    private static func numbered(_ contents: [FeedRow.Content]) -> [FeedRow] {
        contents.enumerated().map { position, content in
            FeedRow(id: position, content: content)
        }
    }
}
