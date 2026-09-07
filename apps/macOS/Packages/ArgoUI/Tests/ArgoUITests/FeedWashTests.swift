@testable import ArgoUI
import Testing

/// What the accent wash stands for, and the one route into the feed that earns it.
///
/// The wash means *what you just sent landed*. It used to be decided on a row-COUNT delta inside
/// one reading, which cannot tell rows that arrived because the reader SENT something from rows
/// that arrived because Argo READ something — so opening a Session bloomed its last prompt over a
/// reading nobody had written to (#1569). The signal here is the Turn this window typed: a
/// `.submitted` row is DIRECT on Argo's own submit, and the wash goes on the prompt the record
/// answered it with.
@Suite("Feed wash")
@MainActor
struct FeedWashTests {
    private static let alpha = FeedReading(session: "alpha")
    private static let bravo = FeedReading(session: "bravo")

    /// The reading a Session opens on, with prompts in its history and a submitted Turn nowhere
    /// in it.
    private static func read(_ prompts: [String]) -> [FeedRow] {
        prompts.enumerated().map { position, text in
            FeedRow(id: position, content: .prompt(text: text, shots: []))
        }
    }

    // MARK: - what earns it

    /// The claim the ticket is for. Selecting a Session fills in the stretch the bounded read
    /// skipped, under the SAME reading id — so every count guard passed and the last prompt in the
    /// arriving slice took a wash for words the reader never typed.
    @Test
    func `opening a Session washes nothing, however many rows the read brings`() {
        let rows = Self.read(["from hours ago", "and the one before that"])

        let opened = FeedView.wash(
            from: FeedFact(reading: Self.alpha, value: nil),
            to: FeedFact(reading: Self.alpha, value: nil),
            in: rows,
        )

        #expect(opened == .keep)
    }

    /// The moment the wash exists for: Argo typed a Turn, the record came back with it, and the
    /// row those words landed on is the one that blooms.
    @Test
    func `the Turn this window sent takes the wash when its record answers it`() {
        let rows = Self.read(["from hours ago", "ship it"])

        let landed = FeedView.wash(
            from: FeedFact(reading: Self.alpha, value: "ship it"),
            to: FeedFact(reading: Self.alpha, value: nil),
            in: rows,
        )

        #expect(landed == .onto(1))
    }

    /// A submission ENDING is what earns the wash, whether nothing replaced it or the next Turn
    /// did: the words that just left are in the record now, and their row is the one that blooms.
    @Test
    func `a send that lands under the next one still takes its own row`() {
        let rows = Self.read(["first"])

        let landed = FeedView.wash(
            from: FeedFact(reading: Self.alpha, value: "first"),
            to: FeedFact(reading: Self.alpha, value: "second"),
            in: rows,
        )

        #expect(landed == .onto(0))
    }

    /// The words say which row, not the position: a Session asked the same thing twice washes the
    /// arrival and not the one from before it.
    @Test
    func `the newest row carrying those words is the one washed`() {
        let rows = Self.read(["again", "in between", "again"])

        let landed = FeedView.wash(
            from: FeedFact(reading: Self.alpha, value: "again"),
            to: FeedFact(reading: Self.alpha, value: nil),
            in: rows,
        )

        #expect(landed == .onto(2))
    }

    // MARK: - what does not

    /// The ghosted row Argo has just drawn is not an arrival: nothing has answered it, and washing
    /// it would say the CLI heard words there is no evidence it heard (`FeedPromptTier.submitted`).
    @Test
    func `the Turn just typed takes no wash while nothing has answered it`() {
        let rows = Self.read(["from hours ago"]) +
            [FeedRow(id: 1, content: .submitted(text: "ship it"))]

        let typed = FeedView.wash(
            from: FeedFact(reading: Self.alpha, value: nil),
            to: FeedFact(reading: Self.alpha, value: "ship it"),
            in: rows,
        )

        #expect(typed == .keep)
    }

    /// A submission can end without its words reaching the record — a Turn reported lost drops the
    /// row the way an answered one does. With nothing carrying those words, nothing is washed:
    /// ambiguity resolves to the quieter claim.
    @Test
    func `a submission no prompt answered washes nothing`() {
        let rows = Self.read(["from hours ago"])

        let lost = FeedView.wash(
            from: FeedFact(reading: Self.alpha, value: "never heard"),
            to: FeedFact(reading: Self.alpha, value: nil),
            in: rows,
        )

        #expect(lost == .keep)
    }

    /// Another READING is never an arrival, however it ended: the wash leaves with the reading
    /// that earned it.
    @Test
    func `another reading clears the wash`() {
        let switched = FeedView.wash(
            from: FeedFact(reading: Self.bravo, value: "ship it"),
            to: FeedFact(reading: Self.alpha, value: nil),
            in: Self.read(["ship it"]),
        )

        #expect(switched == .clear)
    }

    // MARK: - the signal itself

    /// What the whole decision is keyed on, read off the rows the feed already has: the Turn this
    /// window typed, or nothing where it has typed none.
    @Test
    func `the submitted Turn is read off the rows and nothing else is`() {
        let read = Self.read(["from hours ago"])

        #expect(FeedView.sent(in: read) == nil)
        #expect(
            FeedView.sent(in: read + [FeedRow(id: 1, content: .submitted(text: "ship it"))]) ==
                "ship it",
        )
    }
}
