import AppKit

/// What the feed's own words actually measure, asked of Core Text rather than estimated.
///
/// Everything drawing or mapping the feed comes here for a width. A pipe table divides the measure
/// by what its columns ask for; the overview lane reports a paragraph's lines at the widths they
/// wrapped to. Both are questions about glyphs, and neither is answered within a third by a count
/// of characters.
///
/// Every answer is cached, because the callers ask per row and per cell. The wrapped answers are
/// dropped whole when the measure moves, which is the seam under the reader's finger: a cache keyed
/// by text AND width would hold one entry per pixel of the drag.
/// Asked from any thread since ADR-0030: the whole-document measure pass typesets its rows off the
/// main actor and in parallel, so every store here is lock-guarded and none of them is held across
/// the Core Text pass it answers with — see `ProseStore`.
public enum ProseMetrics {
    private static let widths = ProseStore<CGFloat>()
    private static let words = ProseStore<CGFloat>()
    /// Wrapped answers, one store per measure they were asked at. Several measures are in use at
    /// once — the reading's column, the inside of a prompt's bubble, one per table column — so a
    /// single store would be emptied by every row that followed a table. Held to a handful and then
    /// dropped whole, because a seam under the reader's finger asks at a different measure every
    /// frame.
    private static let lays = ProseMeasuredStore<ProseLay>()

    /// The wrapped store held to what a walk is about to ask it for — `ProseCache`'s own rule,
    /// forwarded because `lays` is private here.
    ///
    /// Its caller is the overview lane, which since #1132 draws a whole session's shapes in one
    /// band, and asks for more than one text a row: a heading and a paragraph apiece measured 600
    /// asks over 300 rows. Left at the literal 512 the paint evicted its own head before it reached
    /// its foot, so every repaint of a fitted session paid every parse again (ADR-0028 Rule 4).
    public static func holding(texts: Int) {
        lays.hold(atLeast: texts)
    }

    /// The setting the stores were filled at — see `atCurrentSize()`.
    private static let readAt = ProseTally(ProseTextSize.epoch())

    #if DEBUG
        /// Every Core Text pass this has ever paid for, cache misses only — the glyph work itself.
        ///
        /// It lives out here rather than on the stores because `lays` is dropped whole when the
        /// measure moves, and a counter dropped with it could not say what a seam drag cost. What
        /// lets the overview lane's budgets be COUNTS instead of the seconds literals ADR-0028
        /// Rule 7 forbids: a count is exactly the same idle and loaded, and glyph work is the whole
        /// of what those budgets were ever about.
        public static var typesets: Int {
            typeset.withLock { $0 }
        }

        /// What ONE caller paid, counted over `work` and nothing else.
        ///
        /// The process-wide counter above cannot answer that any more. Until ADR-0030 every
        /// typeset in the process happened on the main actor, so a main-actor case reading the
        /// counter either side of its own work was reading its own work; now the whole-document
        /// measure pass typesets off the main actor and across cores, and a suite running beside
        /// one is counting somebody else's document.
        ///
        /// A task local, because that is the scope the answer is true in: the pass's own child
        /// tasks inherit it and every other task in the process does not.
        public static func typesets(during work: () -> Void) -> Int {
            let own = ProseTally(0)
            $counting.withValue(own) { work() }
            return own.withLock { $0 }
        }

        @TaskLocal static var counting: ProseTally<Int>?

        private static let typeset = ProseTally(0)
    #endif

    /// How wide `text` would run on one line, its inline marks read and taken off.
    public static func width(of text: String, in face: ProseFace = .body) -> CGFloat {
        atCurrentSize()
        return widths.reading(of: keyed(text, in: face)) { _ in
            counted { measured(ProseMarks.marked(text), in: face) }
        }
    }

    /// How wide its widest unbreakable word runs — the floor under a column holding it.
    public static func word(in text: String, face: ProseFace = .body) -> CGFloat {
        atCurrentSize()
        return words.reading(of: keyed(text, in: face)) { _ in
            counted { widestWord(in: ProseMarks.marked(text), face: face) }
        }
    }

    /// How `text` came out once it wrapped across `measure` — see `ProseLay`.
    ///
    /// KEPT, because this is what a whole-document walk asks per row and the overview lane asks
    /// again on every repaint. A `ProseLay` is lengths and offsets, which is state a lock may hand
    /// across a thread.
    public static func lay(out text: String, across measure: CGFloat, in face: ProseFace = .body)
        -> ProseLay {
        guard measure > 0 else { return ProseLay() }
        atCurrentSize()
        return lays.reading(of: keyed(text, in: face), across: measure) { _ in
            counted { laid(out: text, across: measure, in: face).lay }
        }
    }

    /// The same wrap as the LINES it broke into, so what draws the words is what measured them
    /// (ADR-0030, Rule 2).
    ///
    /// NOT kept, and that is the line a `Mutex` draws: a run holds `CTLine`s, which are not state a
    /// lock may hand across a thread, and the pass that measures a whole document runs off the main
    /// actor (`ProseStore`). What keeps a run from being typeset twice for a row is a layer up —
    /// `ProseReading.frame(of:across:)` holds the whole placed frame, on the actor that draws it.
    public static func run(of text: String, across measure: CGFloat, in face: ProseFace = .body)
        -> ProseRun {
        guard measure > 0 else { return ProseRun(lines: [], face: face) }
        atCurrentSize()
        return counted { laid(out: text, across: measure, in: face).run }
    }

    /// Drops what was measured at a size the reader has since moved off (#1027).
    ///
    /// Every answer held here came through a font the Accessibility text setting decides, and the
    /// key says which FACE it was measured in but not at which size. Dropped rather than keyed for
    /// two reasons: a resolved size in the key would put an `NSFont.preferredFont` read on every
    /// ask, which costs a multiple of the warm ask it would be part of (`PerfBudgets`'
    /// `keyedTextSizeFold`), and it would leave every entry taken at the old size resident until
    /// the ceiling reached it.
    ///
    /// The ceiling survives the drop — it is a fact about the DOCUMENT being walked, which a text
    /// size does not change.
    private static func atCurrentSize() {
        let epoch = ProseTextSize.epoch()
        let moved = readAt.withLock { at -> Bool in
            guard at != epoch else { return false }
            at = epoch
            return true
        }
        guard moved else { return }
        widths.empty()
        words.empty()
        lays.empty()
    }

    /// One cache key. The face is part of it because the same words measure differently at every
    /// face, and a store keyed on the text alone would answer a heading with a paragraph's width.
    private static func keyed(_ text: String, in face: ProseFace) -> String {
        "\(face.key)\u{0}\(text)"
    }

    /// One Core Text pass, counted. Wrapped around the read rather than the ask, so what it counts
    /// is the work paid for and never an answer the store already held.
    private static func counted<Value>(_ pass: () -> Value) -> Value {
        #if DEBUG
            typeset.withLock { $0 += 1 }
            counting?.withLock { $0 += 1 }
        #endif
        return pass()
    }

    private static func measured(_ marked: AttributedString, in face: ProseFace) -> CGFloat {
        guard !marked.characters.isEmpty else { return 0 }
        return typeset(marked, in: face).size().width
    }
}
