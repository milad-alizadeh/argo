import AppKit

// One paragraph laid out, and the two things anybody asks about the result. Both come from a single
// Core Text pass, because both are answers about the same wrap: doing them separately laid the same
// words out twice and let the two answers disagree.

/// How a paragraph came out once it wrapped.
public struct ProseLay: Equatable, Sendable {
    /// How wide each line came out, in POINTS, in the order the lines are read. Points and not
    /// shares, because a share is only meaningful beside the measure it was taken against — and the
    /// lane asks for these to put them somewhere else.
    public var widths: [CGFloat] = []
    /// Where the links inside it landed.
    public var links: [ProsePlace] = []

    public init(widths: [CGFloat] = [], links: [ProsePlace] = []) {
        self.widths = widths
        self.links = links
    }

    public var lines: Int {
        widths.count
    }
}

/// Where a span of words sits once they wrapped: which line, and how far across it runs in POINTS.
///
/// The lane drew a link from its offset in the SOURCE instead, so `[label](url)` spanned the width
/// of the whole construct — url and brackets — at a place the words had long since moved past.
public struct ProsePlace: Equatable, Sendable {
    public var line: Int
    public var from: CGFloat
    public var to: CGFloat

    public init(line: Int, from: CGFloat, to: CGFloat) {
        self.line = line
        self.from = from
        self.to = to
    }
}

/// One wrap, held as both answers about it: the lines themselves and the reduction of them the
/// overview lane reads. Two typesets of one string is how a drawn row and its map came apart, so
/// there is one — see `ProseRun`.
struct ProseTypeset {
    var run: ProseRun
    var lay: ProseLay
}

extension ProseMetrics {
    static func laid(out text: String, across measure: CGFloat, in face: ProseFace)
        -> ProseTypeset {
        let string = typeset(ProseMarks.marked(text), in: face)
        guard string.length > 0, measure > 0 else {
            return ProseTypeset(run: ProseRun(lines: [], face: face), lay: ProseLay())
        }
        let lines = broken(string, across: measure)
        return ProseTypeset(
            run: ProseRun(lines: lines, face: face),
            lay: ProseLay(
                widths: lines.map {
                    min(measure, CGFloat(CTLineGetTypographicBounds($0, nil, nil, nil)))
                },
                links: places(of: links(in: string), on: lines, across: measure),
            ),
        )
    }

    /// The lines the words broke into. A frame tall enough to hold any paragraph, because Core Text
    /// drops the lines that fall outside the path it is given.
    private static func broken(_ string: NSAttributedString, across measure: CGFloat) -> [CTLine] {
        let setter = CTFramesetterCreateWithAttributedString(string)
        let room = CGRect(x: 0, y: 0, width: measure, height: 1_000_000)
        let frame = CTFramesetterCreateFrame(
            setter, CFRange(), CGPath(rect: room, transform: nil), nil,
        )
        return CTFrameGetLines(frame) as? [CTLine] ?? []
    }

    /// The linked spans of the RENDERED words, taken off the attribute the markdown read put there
    /// — so what is marked is the label the reader sees, which is what the feed inks.
    private static func links(in string: NSAttributedString) -> [NSRange] {
        var ranges: [NSRange] = []
        string.enumerateAttribute(
            .link, in: NSRange(location: 0, length: string.length),
        ) { value, range, _ in
            guard value != nil else { return }
            ranges.append(range)
        }
        return ranges
    }

    /// Each span placed on the lines it covers — two entries for the rare link that wrapped, and
    /// one for every other.
    private static func places(
        of ranges: [NSRange],
        on lines: [CTLine],
        across measure: CGFloat,
    )
        -> [ProsePlace] {
        lines.enumerated().flatMap { at, line in
            let extent = CTLineGetStringRange(line)
            return ranges.compactMap { range -> ProsePlace? in
                let low = max(range.location, extent.location)
                let high = min(range.upperBound, extent.location + extent.length)
                guard low < high else { return nil }
                return ProsePlace(
                    line: at,
                    from: min(measure, CTLineGetOffsetForStringIndex(line, low, nil)),
                    to: min(measure, CTLineGetOffsetForStringIndex(line, high, nil)),
                )
            }
        }
    }
}
