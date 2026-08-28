import Foundation

// A pie chart's source, read whole or not at all.
//
// The half that matters is the `nil`, exactly as it is for the flowchart and the sequence: a line
// this reader has no rule for — a directive it does not know, a value it cannot draw a wedge for,
// a row still streaming in — leaves the block the fence it is today (#859).

extension MermaidPie {
    /// The pie chart this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidPie? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, var pie = read(header: header) else { return nil }
        lines.removeFirst()
        for line in lines {
            guard pie.add(line) else { return nil }
        }
        // A header on its own is a chart with nothing in it — which is also what a fence looks
        // like halfway through arriving.
        return pie.slices.isEmpty ? nil : pie
    }

    /// `pie`, and the two things mermaid lets it carry on its own line. Anything else after the
    /// keyword is a header this reader does not own.
    private static func read(header: String) -> MermaidPie? {
        guard var rest = tail(of: header, after: "pie") else { return nil }
        var pie = MermaidPie()
        if let shown = tail(of: rest, after: "showData") {
            pie.showsData = true
            rest = shown
        }
        guard !rest.isEmpty else { return pie }
        guard let title = title(of: rest) else { return nil }
        pie.title = title
        return pie
    }

    /// One body line: another title, or a row. Two rules and no third, which is what makes the
    /// refusal below total.
    private mutating func add(_ line: String) -> Bool {
        if let named = Self.title(of: line) {
            title = named
            return true
        }
        guard let slice = Self.slice(of: line) else { return false }
        slices.append(slice)
        return true
    }

    /// `title <words>` — the same rule on the header and on a line of its own, so the two
    /// spellings cannot drift.
    private static func title(of line: String) -> String? {
        guard let words = tail(of: line, after: "title"), !words.isEmpty else { return nil }
        return words
    }

    /// `"label" : value`. The quotes are not decoration: they are what lets a label carry the
    /// colon that would otherwise end it.
    private static func slice(of line: String) -> Slice? {
        guard line.hasPrefix("\"") else { return nil }
        let body = line.dropFirst()
        guard let close = body.firstIndex(of: "\"") else { return nil }
        let rest = body[body.index(after: close)...].trimmingCharacters(in: .whitespaces)
        guard rest.hasPrefix(":") else { return nil }
        let number = rest.dropFirst().trimmingCharacters(in: .whitespaces)
        guard let value = Double(number), value.isFinite, value >= 0 else { return nil }
        return Slice(label: String(body[..<close]), value: value)
    }

    /// What is left of `line` after `keyword`, or `nil` where the line does not open with it.
    /// Case-insensitive on the keyword alone, because mermaid's own are.
    private static func tail(of line: String, after keyword: String) -> String? {
        guard line.count >= keyword.count,
              line.prefix(keyword.count).lowercased() == keyword.lowercased()
        else { return nil }
        let rest = line.dropFirst(keyword.count)
        guard rest.isEmpty || rest.hasPrefix(" ") else { return nil }
        return rest.trimmingCharacters(in: .whitespaces)
    }
}
