import AppKit

/// What the feed's own words actually measure, asked of Core Text rather than estimated.
///
/// Two surfaces need real numbers rather than a character count. A pipe table divides the measure
/// by what its columns ask for, and the overview lane draws a paragraph's lines at the widths the
/// paragraph wrapped to — both of which are questions about glyphs, and neither of which a count of
/// characters answers within a third.
///
/// Every answer is cached, because both callers ask per row and per cell. The wrapped answers are
/// dropped whole when the measure moves, which is the seam under the reader's finger: a cache keyed
/// by text AND width would hold one entry per pixel of the drag.
@MainActor
enum ProseMetrics {
    /// The font the feed's body is set in. AppKit's own preferred font for the rung, so this
    /// and the `Text` on screen read the same table — see `ArgoTypeScale+AppKit`.
    static var bodyFont: NSFont {
        NSFont.preferredFont(forTextStyle: ArgoFeedRow.proseRung.appKitStyle)
    }

    /// The same font at the weight a table's header takes, which is wider at every rung.
    static var headerFont: NSFont {
        NSFontManager.shared.convert(bodyFont, toHaveTrait: .boldFontMask)
    }

    private static var widths = ProseCache<CGFloat>()
    private static var headerWidths = ProseCache<CGFloat>()
    private static var words = ProseCache<CGFloat>()
    /// Wrapped answers, one store per measure they were asked at. Two measures are in use at once —
    /// the reading's column, and the narrower inside of a prompt's bubble — so a single store would
    /// be emptied by every row that followed a prompt. Held to a handful and then dropped whole,
    /// because a seam under the reader's finger asks at a different measure every frame.
    private static var wraps: [CGFloat: ProseCache<[CGFloat]>] = [:]
    private static let measuresHeld = 4

    /// How wide `text` would run on one line, its inline marks read and taken off. A header cell
    /// measures at its own weight: a column sized to the body's would clip the words above it.
    static func width(of text: String, header: Bool = false) -> CGFloat {
        guard header else { return widths.reading(of: text) { measured(rendered($0)) } }
        return headerWidths.reading(of: text) { measured(rendered($0), in: headerFont) }
    }

    /// How wide its widest unbreakable word runs — the floor under a column holding it.
    static func word(in text: String, header: Bool = false) -> CGFloat {
        let font = header ? headerFont : bodyFont
        return words.reading(of: "\(header)\u{0}\(text)") { _ in
            let longest = rendered(text)
                .split(whereSeparator: \.isWhitespace)
                .max { $0.count < $1.count }
            return measured(longest.map { String($0) } ?? "", in: font)
        }
    }

    /// How full each line is once `text` wraps across `measure`, as shares of it — the ragged edge
    /// the paragraph really has, in the order its lines have it.
    static func wrap(of text: String, across measure: CGFloat) -> [CGFloat] {
        guard measure > 0 else { return [] }
        if wraps[measure] == nil, wraps.count >= measuresHeld {
            wraps.removeAll()
        }
        var store = wraps[measure] ?? ProseCache<[CGFloat]>()
        let lines = store.reading(of: text) { text in
            fragments(of: rendered(text), across: measure).map { min(1, $0 / measure) }
        }
        wraps[measure] = store
        return lines
    }

    /// The words as the feed draws them: the agent's inline marks read, so `**bold**` measures as
    /// the four letters it renders and not as the eight characters it was written with.
    private static func rendered(_ text: String) -> String {
        String(ProseReading.marked(text).characters)
    }

    private static func measured(_ text: String, in font: NSFont? = nil) -> CGFloat {
        guard !text.isEmpty else { return 0 }
        return NSAttributedString(string: text, attributes: [.font: font ?? bodyFont])
            .size().width
    }

    /// The typographic width of every line the text broke into. A frame tall enough to hold any
    /// paragraph, because Core Text drops the lines that fall outside the path it is given.
    private static func fragments(of text: String, across measure: CGFloat) -> [CGFloat] {
        guard !text.isEmpty else { return [] }
        let string = NSAttributedString(string: text, attributes: [.font: bodyFont])
        let setter = CTFramesetterCreateWithAttributedString(string)
        let room = CGRect(x: 0, y: 0, width: measure, height: 1_000_000)
        let frame = CTFramesetterCreateFrame(
            setter, CFRange(), CGPath(rect: room, transform: nil), nil,
        )
        let lines = CTFrameGetLines(frame) as? [CTLine] ?? []
        return lines.map { CGFloat(CTLineGetTypographicBounds($0, nil, nil, nil)) }
    }
}
