import Foundation

extension SkillFrontmatter {
    /// A value written under its key rather than beside it — `description: >` and the indented
    /// lines below it. The skills installed on this machine use `>`, `>-` and `|`.
    struct BlockScalar {
        /// `|` keeps the author's line breaks; `>` folds them into spaces.
        private let keepsNewlines: Bool

        /// `nil` for anything that is not a block header.
        init?(header: String) {
            guard let indicator = header.first, indicator == ">" || indicator == "|" else {
                return nil
            }
            // Only a chomping indicator may follow: `> words` is a plain scalar, not a block.
            guard header.dropFirst().allSatisfy({ $0 == "-" || $0 == "+" }) else { return nil }
            self.keepsNewlines = indicator == "|"
        }

        /// The block's own lines, from what follows its header. It ends at the first line that is
        /// neither blank nor indented, and the blank lines at either end go.
        func value(from following: [String]) -> String? {
            let lines = following
                .prefix(while: Self.belongsToBlock)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .drop(while: \.isEmpty)
            let body = lines.reversed().drop(while: \.isEmpty).reversed()
            guard !body.isEmpty else { return nil }
            return body.joined(separator: keepsNewlines ? "\n" : " ")
        }

        private static func belongsToBlock(_ line: String) -> Bool {
            line.trimmingCharacters(in: .whitespaces).isEmpty || line.hasPrefix(" ")
        }
    }

    /// A plain scalar as the row should read it. Only the surrounding quotes go: `#` and `:` appear
    /// inside real descriptions, and stripping them would invent a line the file does not carry.
    static func unquoted(_ value: String) -> String? {
        guard !value.isEmpty else { return nil }
        guard let quote = value.first, quote == "\"" || quote == "'",
              value.count > 1, value.last == quote
        else { return value }
        return String(value.dropFirst().dropLast())
    }
}
