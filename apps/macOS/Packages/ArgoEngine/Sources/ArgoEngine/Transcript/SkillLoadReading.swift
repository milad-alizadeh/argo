import Foundation

// A meta record naming a skill's directory → the load it stands for (#688).
//
// The record carries an expanded copy of the body, and it is not the file: the CLI takes the
// frontmatter off it and staples the invocation's arguments on. What the panel opens is the file.

/// Reading one `SKILL.md` off disk, or `nil` where it cannot be read at all. A port, so the reading
/// is falsifiable with no skill on the machine.
public typealias SkillReader = @Sendable (String) -> String?

/// The default: nothing on disk. A parse given no reader says the file went unread rather than
/// inventing a body for it.
public let noSkillReader: SkillReader = { _ in nil }

public let diskSkillReader: SkillReader = { path in
    try? String(contentsOf: URL(fileURLWithPath: path), encoding: .utf8)
}

/// One named directory → what the marker beside it can honestly say.
func skillLoad(at directory: String, read: SkillReader) -> SkillLoad {
    let known = URL(fileURLWithPath: directory).lastPathComponent
    let path = SkillLoad.path(under: directory)
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
