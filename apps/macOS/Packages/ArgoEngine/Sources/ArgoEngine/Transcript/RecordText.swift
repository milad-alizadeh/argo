import Foundation

// The two primitives every reading of a user record's own text is built on. Their own file rather
// than `HarnessRecord`'s, because a second reader needs them and a `private` at file scope is a
// wall: `ShellCommand` reads the same markup off the same records (#1595).

/// The first textual part of a record's content with anything in it. Blank parts are stepped over
/// rather than answered with.
func firstText(_ content: [ContentBlock]) -> String? {
    for block in content {
        guard case let .text(text) = block,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { continue }
        return text
    }
    return nil
}

/// The contents of one `<name>…</name>` tag.
func tagged(_ name: String, in text: String) -> String? {
    // `[\s\S]` rather than `.`, which stops at a newline: a command's body routinely spans lines.
    guard let match = text.range(
        of: "<\(name)>[\\s\\S]*?</\(name)>",
        options: [.regularExpression],
    ) else { return nil }
    let inner = text[match].dropFirst(name.count + 2).dropLast(name.count + 3)
    return inner.trimmingCharacters(in: .whitespacesAndNewlines)
}
