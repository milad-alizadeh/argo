import Foundation

/// The `name` and one-line `description` a `SKILL.md` states about itself, read from the same bytes
/// the CLI reads (#685). Either is absent rather than guessed when the file states none.
///
/// Not `Codable`: this is YAML, and the two keys wanted are top-level scalars. The parse is
/// narrow — see `SkillFrontmatter+Scalar.swift` for the value shapes it covers.
struct SkillFrontmatter: Equatable {
    let name: String?
    let description: String?

    /// `nil` when the file carries no frontmatter at all, which is not the same as a frontmatter
    /// with neither key: such a file is not a skill.
    init?(markdown: String) {
        guard let fenced = Self.fenced(in: markdown) else { return nil }
        self.name = Self.value(of: "name", in: fenced)
        self.description = Self.value(of: "description", in: fenced)
    }

    /// The markdown BELOW the frontmatter — the instructions the agent was handed (#688). A file
    /// carrying no frontmatter at all is all body, which is what a `SKILL.md` nothing recognises
    /// still has to show. `nil` where nothing is left, so a caller can say there is nothing behind
    /// the marker rather than opening onto a blank.
    static func body(of markdown: String) -> String? {
        let lines = Self.lines(of: markdown)
        let below = Self.close(in: lines).map { Array(lines[($0 + 1)...]) } ?? lines
        let body = below.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return body.isEmpty ? nil : body
    }

    /// The lines between the opening `---` and the next one. The fence must be the file's very
    /// first line, unindented.
    private static func fenced(in markdown: String) -> [String]? {
        let lines = Self.lines(of: markdown)
        guard let close = Self.close(in: lines) else { return nil }
        return Array(lines[1 ..< close])
    }

    private static func lines(of markdown: String) -> [String] {
        markdown.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    }

    /// Where the frontmatter ends, or `nil` where the file opens no fence at all.
    private static func close(in lines: [String]) -> Int? {
        guard lines.first == "---" else { return nil }
        return lines.dropFirst().firstIndex(of: "---")
    }

    /// One top-level key's value. Top-level only: the same word indented under another key belongs
    /// to that key, so an indented line never answers here.
    private static func value(of key: String, in lines: [String]) -> String? {
        guard let at = lines.firstIndex(where: { $0.hasPrefix("\(key):") }) else { return nil }
        let inline = lines[at]
            .dropFirst(key.count + 1)
            .trimmingCharacters(in: .whitespaces)
        guard let block = BlockScalar(header: inline) else { return Self.unquoted(inline) }
        return block.value(from: Array(lines[(at + 1)...]))
    }
}
