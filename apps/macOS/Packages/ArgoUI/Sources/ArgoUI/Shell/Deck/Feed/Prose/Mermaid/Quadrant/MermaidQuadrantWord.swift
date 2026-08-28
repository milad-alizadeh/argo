import Foundation

/// What one line of a quadrant chart says. A line is read whole or not at all: `nil` is a line
/// this reader has no rule for, which leaves the whole block the fence it is today (#859).
enum MermaidQuadrantWord: Equatable {
    case title(String)
    case axis(isVertical: Bool, MermaidQuadrant.Axis)
    case corner(MermaidQuadrant.Corner, String)
    case point(MermaidQuadrant.Point)

    static func of(_ line: String) -> Self? {
        if let text = rest(after: "title", of: line) {
            return .title(text)
        }
        for (keyword, isVertical) in [("x-axis", false), ("y-axis", true)] {
            guard let text = rest(after: keyword, of: line) else { continue }
            return .axis(isVertical: isVertical, axis(of: text))
        }
        for corner in MermaidQuadrant.Corner.allCases {
            guard let text = rest(after: "quadrant-\(corner.rawValue)", of: line) else { continue }
            return .corner(corner, text)
        }
        return point(of: line).map(Self.point)
    }

    /// The words after `keyword`, or `nil` where this line does not open with it. Matched as a
    /// WORD and never as a prefix, so `quadrant-1` is never read out of `quadrant-11` — and never
    /// with nothing after it, because a keyword naming nothing is a line half written.
    private static func rest(after keyword: String, of line: String) -> String? {
        guard line.lowercased().hasPrefix(keyword) else { return nil }
        let after = line.dropFirst(keyword.count)
        guard after.first?.isWhitespace == true else { return nil }
        let rest = after.trimmingCharacters(in: .whitespaces)
        return rest.isEmpty ? nil : rest
    }

    /// An axis's two ends. `-->` divides them; an axis written without one names only where its
    /// scale starts, which is how mermaid labels a half-named axis.
    private static func axis(of text: String) -> MermaidQuadrant.Axis {
        guard let split = text.range(of: "-->") else {
            return MermaidQuadrant.Axis(start: text)
        }
        return MermaidQuadrant.Axis(
            start: String(text[..<split.lowerBound]).trimmingCharacters(in: .whitespaces),
            end: String(text[split.upperBound...]).trimmingCharacters(in: .whitespaces),
        )
    }

    /// `Name: [x, y]`. A coordinate off the 0…1 scale is a chart mermaid itself refuses to plot,
    /// so it is one this reader leaves as a fence rather than drawing outside its own field.
    private static func point(of line: String) -> MermaidQuadrant.Point? {
        let parts = line.split(separator: ":", maxSplits: 1)
        guard parts.count == 2 else { return nil }
        let name = parts[0].trimmingCharacters(in: .whitespaces)
        let body = parts[1].trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, body.hasPrefix("["), body.hasSuffix("]") else { return nil }
        let scale = 0.0 ... 1.0
        let numbers = body.dropFirst().dropLast().split(separator: ",")
            .compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard numbers.count == 2, numbers.allSatisfy(scale.contains) else { return nil }
        return MermaidQuadrant.Point(name: name, at: CGPoint(x: numbers[0], y: numbers[1]))
    }
}
