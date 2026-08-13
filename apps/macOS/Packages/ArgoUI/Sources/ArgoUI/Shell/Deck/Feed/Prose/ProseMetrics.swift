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

    /// How wide `text` would run on one line, its inline marks read and taken off.
    static func width(of text: String, in face: ProseFace = .body) -> CGFloat {
        widths.reading(of: keyed(text, in: face)) { _ in measured(rendered(text), in: face) }
    }

    /// How wide its widest unbreakable word runs — the floor under a column holding it.
    static func word(in text: String, face: ProseFace = .body) -> CGFloat {
        words.reading(of: keyed(text, in: face)) { _ in
            let longest = rendered(text)
                .split(whereSeparator: \.isWhitespace)
                .max { $0.count < $1.count }
            return measured(longest.map { String($0) } ?? "", in: face)
        }
    }

    /// How `text` came out once it wrapped across `measure` — see `ProseLay`.
    static func lay(out text: String, across measure: CGFloat, in face: ProseFace = .body)
        -> ProseLay {
        guard measure > 0 else { return ProseLay() }
        if lays[measure] == nil, lays.count >= measuresHeld {
            lays.removeAll()
        }
        var store = lays[measure] ?? ProseCache<ProseLay>()
        let lay = store.reading(of: keyed(text, in: face)) { _ in
            laid(out: text, across: measure, in: face)
        }
        lays[measure] = store
        return lay
    }

    /// The words as the feed draws them: the agent's inline marks read, so `**bold**` measures as
    /// the four letters it renders and not as the eight characters it was written with.
    static func rendered(_ text: String) -> String {
        String(ProseReading.marked(text).characters)
    }

    /// One cache key. The face is part of it because the same words measure differently at every
    /// face, and a store keyed on the text alone would answer a heading with a paragraph's width.
    private static func keyed(_ text: String, in face: ProseFace) -> String {
        "\(face.key)\u{0}\(text)"
    }

    private static func measured(_ text: String, in face: ProseFace) -> CGFloat {
        guard !text.isEmpty else { return 0 }
        return NSAttributedString(string: text, attributes: [.font: face.font])
            .size().width
    }
}
