import ArgoEngine
import Foundation

/// The `@` mentions a finished line names, and the files they stand for (#687).
///
/// `ComposerMenu.mention` finds the ONE token still being typed, to open a menu over it.
/// This finds every SETTLED one, at send, which is a different question with a different answer.
enum ComposerMentions {
    /// Every `@` token in the line, as paths relative to the Workspace, in the order said.
    ///
    /// A token boundary opens one and whitespace closes it, the same two rules the menu opens on,
    /// so `milad@example.com` is an address here too. Punctuation around the token is dropped
    /// before the sigil is looked for, because a mention inside a bracket still opens one.
    static func mentioned(in text: String) -> [String] {
        text.split(whereSeparator: \.isWhitespace)
            .map { $0.trimmingCharacters(in: surroundingPunctuation) }
            .filter { $0.first == sigil }
            .map { String($0.dropFirst()) }
            .filter { !$0.isEmpty }
    }

    /// The files those mentions stand for. Only ones that exist and stay inside the Workspace: a
    /// mention Argo cannot stand behind is left as the text the reader typed, for the agent to make
    /// of what it will.
    static func urls(mentionedIn text: String, within root: String?) -> [URL] {
        guard let root, !root.isEmpty else { return [] }
        let rootURL = URL(fileURLWithPath: root).standardizedFileURL
        return mentioned(in: text).compactMap { path in
            let url = rootURL.appendingPathComponent(path).standardizedFileURL
            guard url.path.hasPrefix(rootURL.path + "/"),
                  FileManager.default.fileExists(atPath: url.path)
            else { return nil }
            return url
        }
    }

    /// What the Turn must name so the file reaches an agent whose CLI will not resolve the token
    /// itself.
    static func attachments(in text: String, within root: String?) -> [SessionAttachment] {
        urls(mentionedIn: text, within: root).map(SessionAttachment.file(at:))
    }

    /// Everything the Turn goes with: what the reader dropped, then the files its mentions name.
    ///
    /// A file both dropped AND mentioned is named once. The dropped one wins because it is the one
    /// wearing a chip, and a Turn naming the same path twice would read as two files.
    static func attaching(
        _ attachments: [SessionAttachment],
        for text: String,
        within root: String?,
    )
        -> [SessionAttachment] {
        let dropped = Set(attachments.compactMap(fileURL))
        return attachments + urls(mentionedIn: text, within: root)
            .filter { !dropped.contains($0) }
            .map(SessionAttachment.file(at:))
    }

    /// Where an attachment's bytes already sit, and `nil` for a paste that has nowhere yet.
    private static func fileURL(of attachment: SessionAttachment) -> URL? {
        guard case let .file(url) = attachment.source else { return nil }
        return url.standardizedFileURL
    }

    private static let sigil: Character = "@"
    private static let surroundingPunctuation = CharacterSet(charactersIn: ".,;:!?()[]{}\"'")
}
