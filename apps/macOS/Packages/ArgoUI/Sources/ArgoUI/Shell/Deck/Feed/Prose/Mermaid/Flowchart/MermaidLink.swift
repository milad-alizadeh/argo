import Foundation

/// One link between two node groups, read: how it is drawn, whether it ends in a head, and the word
/// written on it.
///
/// Mermaid spells a link's word two ways — `A -->|text| B` and `A -- text --> B` — and they mean
/// the
/// same thing. Both land here as the same value, so nothing downstream has to know which was
/// written.
struct MermaidLink: Equatable, Sendable {
    var stroke: MermaidFlowchart.Stroke = .solid
    var hasHead = true
    var label: String?

    /// The characters a link's own marks are made of. A run of these opens one, and only a run of
    /// these can close one.
    private static let marks: Set<Character> = ["-", ".", "="]
    /// The shortest a link with no word on it can be written: `---`, `-.-`, `===`.
    private static let openLength = 3
}

extension MermaidLink {
    /// The link at the cursor, or `nil` where the text there is not one this reader draws.
    ///
    /// Read in one direction: the marks that open it decide the stroke, a `>` after them closes an
    /// arrow, and anything else between the opening marks and their answering run is the word.
    static func read(_ scan: inout MermaidScan) -> Self? {
        guard let first = scan.peek(), first == "-" || first == "=" else { return nil }
        let opening = scan.takeRun { marks.contains($0) }
        guard let stroke = stroke(of: opening) else { return nil }
        var link = MermaidLink(stroke: stroke)
        if scan.take(">") {
            return link.piped(&scan)
        }
        guard opening.count < openLength else {
            link.hasHead = false
            return link.piped(&scan)
        }
        return inlined(&scan, link: link, closing: closer(of: stroke))
    }

    /// The rest of an `-- text -->`: its word, the run that answers the opening marks, and the head
    /// on the end of that run if it has one.
    private static func inlined(
        _ scan: inout MermaidScan,
        link: MermaidLink,
        closing: String,
    )
        -> Self? {
        var link = link
        guard let word = scan.takeUpTo(closing) else { return nil }
        _ = scan.takeRun { marks.contains($0) }
        link.hasHead = scan.take(">")
        link.label = word.trimmingCharacters(in: .whitespaces)
        return link.label?.isEmpty == false ? link : nil
    }

    /// Which stroke a run of marks draws. A dot anywhere in it is dotted and an `=` is thick, so
    /// `-..->` and `====>` are the same two links their short forms are.
    private static func stroke(of marks: String) -> MermaidFlowchart.Stroke? {
        guard marks.count > 1 else { return nil }
        if marks.contains(".") {
            return .dotted
        }
        if marks.contains("=") {
            return marks.contains("-") ? nil : .thick
        }
        return .solid
    }

    /// The marks that answer an opening run with a word after it.
    private static func closer(of stroke: MermaidFlowchart.Stroke) -> String {
        switch stroke {
        case .solid: "--"
        case .dotted: ".-"
        case .thick: "=="
        }
    }

    /// The other spelling of a link's word, `-->|text|`, taken after the link itself is whole.
    private func piped(_ scan: inout MermaidScan) -> Self? {
        var link = self
        guard scan.take("|") else { return link }
        let quoted = scan.take("\"")
        guard let word = scan.takeUpTo(quoted ? "\"" : "|") else { return nil }
        if quoted, !(scan.take("\"")) {
            return nil
        }
        guard scan.take("|") else { return nil }
        link.label = word.trimmingCharacters(in: .whitespaces)
        return link.label?.isEmpty == false ? link : nil
    }
}
