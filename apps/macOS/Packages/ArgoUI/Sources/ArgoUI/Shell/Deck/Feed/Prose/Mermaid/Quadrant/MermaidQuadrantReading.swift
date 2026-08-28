import Foundation

// A quadrant chart's source, read whole or not at all — the same bargain the flowchart and the
// sequence reader strike. A line with no rule here leaves the block the fence it is today (#859).

extension MermaidQuadrant {
    /// The quadrant chart this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidQuadrant? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, header.lowercased() == "quadrantchart" else { return nil }
        lines.removeFirst()
        // A header on its own is a field with nothing said about it, which is a fence rather than
        // an empty box.
        guard !lines.isEmpty else { return nil }
        var chart = MermaidQuadrant()
        for line in lines {
            guard chart.add(line) else { return nil }
        }
        return chart
    }

    private mutating func add(_ line: String) -> Bool {
        guard let word = MermaidQuadrantWord.of(line) else { return false }
        switch word {
        case let .title(text):
            title = text
        case let .axis(isVertical, axis):
            if isVertical {
                yAxis = axis
            } else {
                xAxis = axis
            }
        case let .corner(corner, text):
            corners[corner.rawValue - 1] = text
        case let .point(point):
            points.append(point)
        }
        return true
    }
}
