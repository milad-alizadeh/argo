import Foundation
import MermaidLayout

/// One block of the markdown a CLI writes. Nothing here rewrites the words: a block is the same
/// characters with the marker taken off and a role attached, and a line this does not recognise is
/// a paragraph.
enum MarkdownBlock: Equatable {
    /// `#` through `######`. The level is kept rather than flattened: it is the agent's own
    /// outline.
    case heading(level: Int, text: String)
    case paragraph(String)
    /// A `-`, `*` or `+` item. The marker is dropped — the renderer draws its own, so a mixed list
    /// does not read as two.
    case bullet(String)
    /// A `1.` item, keeping the host's own number: a list starting at 3 is a list starting at 3.
    case numbered(marker: String, text: String)
    /// A fenced block, verbatim and unparsed. Its `info` string is the language the agent named,
    /// where it named one.
    case fenced(code: String, info: String?)
    /// A closed `mermaid` fence Argo could read. Found HERE and not while drawing, so the renderer
    /// and the overview lane can never disagree about what the block is; a fence declaring
    /// `mermaid` that nothing can read stays a `fenced`, which is what it looks like today.
    case diagram(MermaidDiagram)
    /// A pipe table. Found when a paragraph closes rather than line by line, because the row of
    /// dashes on the SECOND line is what says the first one was a header.
    case table(MarkdownTable)

    static func blocks(in text: String) -> [MarkdownBlock] {
        var scan = MarkdownScan()
        for line in text.components(separatedBy: "\n") {
            scan.take(line)
        }
        return scan.finished()
    }
}

/// The line-by-line read. The state IS the parse: a fence that is open, a paragraph not yet ended.
private struct MarkdownScan {
    private var blocks: [MarkdownBlock] = []
    private var paragraph: [String] = []
    /// The lines of an open fence, and the language it declared. `nil` while no fence is open.
    private var fence: (lines: [String], info: String?)?

    mutating func take(_ line: String) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("```") {
            toggleFence(declaring: String(trimmed.dropFirst(3)))
        } else if fence != nil {
            fence?.lines.append(line)
        } else if let block = MarkdownBlock.single(trimmed) {
            closeParagraph()
            blocks.append(block)
        } else if trimmed.isEmpty {
            closeParagraph()
        } else {
            paragraph.append(line)
        }
    }

    /// An unterminated fence still closes here — a turn that ended mid-block keeps its text.
    mutating func finished() -> [MarkdownBlock] {
        closeParagraph()
        closeFence(terminated: false)
        return blocks
    }

    private mutating func toggleFence(declaring info: String) {
        if fence == nil {
            closeParagraph()
            fence = (lines: [], info: info.isEmpty ? nil : info)
        } else {
            closeFence(terminated: true)
        }
    }

    /// The fence, as whichever block it turned out to be. A diagram is only tried on a fence the
    /// agent actually CLOSED: half a diagram is a diagram nobody wrote, so a fence still streaming
    /// in stays the source it is until its closing marker arrives.
    private mutating func closeFence(terminated: Bool) {
        guard let fence else { return }
        self.fence = nil
        let code = fence.lines.joined(separator: "\n")
        let declared = fence.info?.trimmingCharacters(in: .whitespaces).lowercased()
        guard terminated, declared == "mermaid",
              let diagram = MermaidDiagram.read(code)
        else {
            blocks.append(.fenced(code: code, info: fence.info))
            return
        }
        blocks.append(.diagram(diagram))
    }

    /// Line breaks INSIDE a paragraph survive: a CLI writes at the terminal's measure, and a run of
    /// lines it meant as one block is joined as it was written rather than reflowed.
    private mutating func closeParagraph() {
        guard !paragraph.isEmpty else { return }
        defer { paragraph = [] }
        guard let table = MarkdownTable.read(paragraph) else {
            blocks.append(.paragraph(paragraph.joined(separator: "\n")))
            return
        }
        blocks.append(.table(table))
    }
}

private extension MarkdownBlock {
    /// The block kinds a single line can be on its own, or `nil` for a line that is prose.
    static func single(_ line: String) -> MarkdownBlock? {
        if let heading = heading(line) {
            return heading
        }
        if let item = listItem(line) {
            return item
        }
        return nil
    }

    package static func heading(_ line: String) -> MarkdownBlock? {
        let hashes = line.prefix { $0 == "#" }
        guard !hashes.isEmpty, hashes.count <= 6 else { return nil }
        let rest = line.dropFirst(hashes.count)
        // A space is what makes it a heading — `#421` is a ticket number, not an outline.
        guard rest.hasPrefix(" ") else { return nil }
        return .heading(
            level: hashes.count,
            text: String(rest.trimmingCharacters(in: .whitespaces)),
        )
    }

    static func listItem(_ line: String) -> MarkdownBlock? {
        if let bullet = ["- ", "* ", "+ "].first(where: line.hasPrefix) {
            return .bullet(String(line.dropFirst(bullet.count)))
        }
        let digits = line.prefix(while: \.isNumber)
        guard !digits.isEmpty else { return nil }
        let rest = line.dropFirst(digits.count)
        guard rest.hasPrefix(". ") || rest.hasPrefix(") ") else { return nil }
        return .numbered(marker: "\(digits).", text: String(rest.dropFirst(2)))
    }
}
