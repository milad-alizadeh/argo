import Foundation

/// A `mermaid` fence's source reduced to the lines a reader really reads: comments taken off, the
/// optional trailing `;` taken off, and the blank lines dropped.
///
/// Shared by every diagram type, because `%%` is mermaid's own comment whatever the fence declares
/// — and a second reader spelling this itself would be one spelling away from reading a label as
/// syntax.
enum MermaidSource {
    static func lines(of source: String) -> [String] {
        source.components(separatedBy: "\n").map(stripped).filter { !$0.isEmpty }
    }

    /// One line, stripped. `%%` opens a comment only OUTSIDE a quoted label, which exists precisely
    /// so a label can carry what would otherwise read as syntax.
    private static func stripped(_ line: String) -> String {
        var kept = ""
        var isQuoted = false
        var previous: Character?
        for character in line {
            if character == "\"" {
                isQuoted.toggle()
            }
            if !isQuoted, character == "%", previous == "%" {
                kept.removeLast()
                break
            }
            kept.append(character)
            previous = character
        }
        let trimmed = kept.trimmingCharacters(in: .whitespaces)
        return (trimmed.hasSuffix(";") ? String(trimmed.dropLast()) : trimmed)
            .trimmingCharacters(in: .whitespaces)
    }
}
