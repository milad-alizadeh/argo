import Foundation

// A meta record naming a skill's directory → the load it stands for (#688).
//
// The record carries the expanded body too, but what the panel opens is the FILE: the reader's
// question is what that skill says, and the record's copy has had its frontmatter taken off and the
// invocation's arguments stapled on. Reading the file is one tier down (DERIVED) and says so by
// naming the path it read.

/// Reading one `SKILL.md` off disk, or `nil` where it cannot be read at all. A port, so the reading
/// is falsifiable without a skill on the machine.
public typealias SkillReader = @Sendable (String) -> String?

/// The default: nothing on disk. A parse given no reader reports the load and says the file went
/// unread, rather than inventing a body for it.
public let noSkillReader: SkillReader = { _ in nil }

/// The real one.
public let diskSkillReader: SkillReader = { path in
    try? String(contentsOf: URL(fileURLWithPath: path), encoding: .utf8)
}

/// One named directory → what the marker beside it can honestly say.
func skillLoad(at directory: String, read: SkillReader) -> SkillLoad {
    let path = directory + "/SKILL.md"
    let known = URL(fileURLWithPath: directory).lastPathComponent
    guard let markdown = read(path) else {
        return SkillLoad(
            name: known,
            directory: directory,
            body: .unreadable("Argo could not read \(path)."),
        )
    }
    return SkillLoad(
        name: SkillFrontmatter(markdown: markdown)?.name ?? known,
        directory: directory,
        body: SkillFrontmatter.body(of: markdown).map(SkillBody.read),
    )
}
