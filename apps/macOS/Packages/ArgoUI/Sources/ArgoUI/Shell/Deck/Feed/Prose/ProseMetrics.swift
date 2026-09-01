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
@MainActor
enum ProseMetrics {
    private static var widths = ProseCache<CGFloat>()
    private static var words = ProseCache<CGFloat>()
    /// Wrapped answers, one store per measure they were asked at. Several measures are in use at
    /// once — the reading's column, the inside of a prompt's bubble, one per table column — so a
    /// single store would be emptied by every row that followed a table. Held to a handful and then
    /// dropped whole, because a seam under the reader's finger asks at a different measure every
    /// frame.
    private static var lays: [CGFloat: ProseCache<ProseLay>] = [:]
    private static let measuresHeld = 8

    /// The setting the stores were filled at — see `atCurrentSize()`.
    private static var readAt = ProseTextSize.epoch()

    #if DEBUG
        /// Every Core Text pass this has ever paid for, cache misses only — the glyph work itself.
        ///
        /// It lives out here rather than on the stores because `lays` is dropped whole when the
        /// measure moves, and a counter dropped with it could not say what a seam drag cost. What
        /// lets the overview lane's budgets be COUNTS instead of the seconds literals ADR-0028
        /// Rule 7 forbids: a count is exactly the same idle and loaded, and glyph work is the whole
        /// of what those budgets were ever about.
        private(set) static var typesets = 0
    #endif

    /// How wide `text` would run on one line, its inline marks read and taken off.
    static func width(of text: String, in face: ProseFace = .body) -> CGFloat {
        atCurrentSize()
        return widths.reading(of: keyed(text, in: face)) { _ in
            counted { measured(ProseReading.marked(text), in: face) }
        }
    }

    /// How wide its widest unbreakable word runs — the floor under a column holding it.
    static func word(in text: String, face: ProseFace = .body) -> CGFloat {
        atCurrentSize()
        return words.reading(of: keyed(text, in: face)) { _ in
            counted { widestWord(in: ProseReading.marked(text), face: face) }
        }
    }

    /// How `text` came out once it wrapped across `measure` — see `ProseLay`.
    static func lay(out text: String, across measure: CGFloat, in face: ProseFace = .body)
        -> ProseLay {
        guard measure > 0 else { return ProseLay() }
        atCurrentSize()
        if lays[measure] == nil, lays.count >= measuresHeld {
            lays.removeAll()
        }
        var store = lays[measure] ?? ProseCache<ProseLay>()
        let lay = store.reading(of: keyed(text, in: face)) { _ in
            counted { laid(out: text, across: measure, in: face) }
        }
        lays[measure] = store
        return lay
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
        guard epoch != readAt else { return }
        readAt = epoch
        widths = ProseCache(ceiling: widths.ceiling, cap: widths.cap)
        words = ProseCache(ceiling: words.ceiling, cap: words.cap)
        lays.removeAll()
    }

    /// One cache key. The face is part of it because the same words measure differently at every
    /// face, and a store keyed on the text alone would answer a heading with a paragraph's width.
    private static func keyed(_ text: String, in face: ProseFace) -> String {
        "\(face.key)\u{0}\(text)"
    }

    /// One Core Text pass, counted. Wrapped around the read rather than the ask, so what it counts
    /// is the work paid for and never an answer the store already held.
    private static func counted<Value>(_ typeset: () -> Value) -> Value {
        #if DEBUG
            typesets += 1
        #endif
        return typeset()
    }

    private static func measured(_ marked: AttributedString, in face: ProseFace) -> CGFloat {
        guard !marked.characters.isEmpty else { return 0 }
        return typeset(marked, in: face).size().width
    }
}
