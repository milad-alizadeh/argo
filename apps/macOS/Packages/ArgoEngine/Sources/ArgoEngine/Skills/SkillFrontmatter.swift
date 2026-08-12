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

    /// The lines between the opening `---` and the next one. The fence must be the file's very
    /// first line, unindented.
    private static func fenced(in markdown: String) -> [String]? {
        let lines = markdown
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
        guard lines.first == "---",
              let close = lines.dropFirst().firstIndex(of: "---")
        else { return nil }
        return Array(lines[1 ..< close])
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
