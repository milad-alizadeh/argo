import Foundation

/// A `note` block still being read: which state it is about, and the lines gathered so far.
struct MermaidStateNote {
    let about: String
    var text = ""

    mutating func add(_ line: String) {
        text += text.isEmpty ? line : " \(line)"
    }
}
