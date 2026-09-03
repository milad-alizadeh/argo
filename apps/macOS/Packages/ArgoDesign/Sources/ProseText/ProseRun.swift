import AppKit

/// A run of words typeset ONCE — the very lines the measure counted, kept so the thing that draws
/// them is the thing that measured them (ADR-0030, Rule 2).
///
/// A height off a line count and a draw off a second typeset are two answers to one question, and
/// nothing downstream can tell a disagreement between them from a bug. Here there is one
/// framesetter pass: `lines.count` is what the height is worked out from, and those same `CTLine`s
/// are what the surface inks.
///
/// Uncoloured on purpose. Ink is applied at DRAW time, run by run, so one typeset answers for a
/// message and for the quieter thought beside it — see `ProseRun.draw(at:ink:in:)`.
public struct ProseRun {
    /// The lines the words broke into, in reading order.
    public let lines: [CTLine]
    /// The face they were set in. Every offset here is counted at its rhythm.
    public let face: ProseFace

    public init(lines: [CTLine], face: ProseFace) {
        self.lines = lines
        self.face = face
    }
}

/// One typeset run of one line, and what the agent's own marks made of it.
///
/// The rectangle is in the run's own coordinates, top-left origin — the space the surface draws in
/// and hit-tests in, so a link's pointer and a link's glyphs cannot come apart.
public struct ProseSpan: Equatable {
    public var rect: CGRect
    /// The link this run is part of, taken off the `.link` attribute the markdown read put there.
    public var url: URL?
    /// Written between backticks. Carries a ground under the glyphs.
    public var isCode: Bool

    public init(rect: CGRect, url: URL? = nil, isCode: Bool = false) {
        self.rect = rect
        self.url = url
        self.isCode = isCode
    }
}

public extension ProseRun {
    /// How tall the run stands — the same arithmetic the feed's height is summed from.
    var height: CGFloat {
        face.height(ofLines: lines.count)
    }

    /// Where line `at`'s baseline sits, counted down from the run's top.
    ///
    /// The line box less what hangs under the first baseline, which is `ProseBaseline`'s MEASURED
    /// number rather than the font's ascent: the engine's own leading is in it and the font's
    /// metrics are not.
    func baseline(ofLine at: Int) -> CGFloat {
        face.lineBox - ProseBaseline.under(face) + face.y(ofLine: at)
    }

    /// Every marked run of every line, placed. The links a surface hit-tests and the grounds it
    /// draws come from this one walk, so a ground and a pointer cannot land in different places.
    var spans: [ProseSpan] {
        lines.enumerated().flatMap { at, line in
            Self.runs(of: line).compactMap { placed($0, onLine: at) }
        }
    }

    /// A glyph run's own typographic box, exactly as a text renderer reports it: the run's advance
    /// wide, its own ascent over its own descent tall, hung off the line's baseline.
    func rect(of run: CTRun, onLine at: Int) -> CGRect {
        var ascent: CGFloat = 0
        var descent: CGFloat = 0
        let width = CGFloat(CTRunGetTypographicBounds(run, CFRange(), &ascent, &descent, nil))
        var start = CGPoint.zero
        CTRunGetPositions(run, CFRange(location: 0, length: 1), &start)
        let baseline = baseline(ofLine: at)
        return CGRect(x: start.x, y: baseline - ascent, width: width, height: ascent + descent)
    }

    static func runs(of line: CTLine) -> [CTRun] {
        CTLineGetGlyphRuns(line) as? [CTRun] ?? []
    }

    /// Written between backticks — the marks the markdown read left on the run, never a guess at
    /// what is inside it.
    static func isCode(_ marks: NSDictionary) -> Bool {
        guard let raw = (marks[NSAttributedString.Key.inlinePresentationIntent] as? NSNumber)?
            .uintValue else { return false }
        return InlinePresentationIntent(rawValue: raw).contains(.code)
    }

    /// One glyph run placed, or `nil` where the record marked it as nothing.
    private func placed(_ run: CTRun, onLine at: Int) -> ProseSpan? {
        let marks = CTRunGetAttributes(run) as NSDictionary
        let url = marks[NSAttributedString.Key.link] as? URL
        let isCode = Self.isCode(marks)
        guard url != nil || isCode else { return nil }
        return ProseSpan(rect: rect(of: run, onLine: at), url: url, isCode: isCode)
    }
}
