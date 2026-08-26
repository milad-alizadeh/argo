import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What a finished line's `@` tokens name, and which of them Argo will stand behind (#687).
@Suite("Composer mentions")
struct ComposerMentionsTests {
    @Test
    func `it names every settled mention in the order they were said`() {
        let found = ComposerMentions.mentioned(in: "Compare @README.md with @docs/adr/ADR-0024.md")

        #expect(found == ["README.md", "docs/adr/ADR-0024.md"])
    }

    /// The same rule the menu opens on: a sigil inside a word is not a mention.
    @Test
    func `an address is not a mention`() {
        #expect(ComposerMentions.mentioned(in: "mail milad@example.com about it").isEmpty)
    }

    /// A mention ending a sentence is followed by the full stop, which is not part of the path.
    @Test(arguments: ["Read @README.md.", "Read @README.md,", "Read (@README.md)"])
    func `trailing punctuation is not part of the path`(_ line: String) {
        #expect(ComposerMentions.mentioned(in: line) == ["README.md"])
    }

    @Test
    func `a bare sigil names nothing`() {
        #expect(ComposerMentions.mentioned(in: "Have a look at @").isEmpty)
    }

    /// The acceptance criterion about scope, asserted at the send end as well as the listing end:
    /// a path climbing out of the Workspace is not one Argo hands over.
    @Test
    func `it stands behind no path outside the Workspace`() throws {
        let root = try workspace()
        let outside = ComposerMentions.attachments(
            in: "look at @../secrets.txt",
            within: root.path,
        )

        #expect(outside.isEmpty)
    }

    @Test
    func `it names a file that is really there, and skips one that is not`() throws {
        let root = try workspace()
        try "hello".write(
            to: root.appendingPathComponent("README.md"),
            atomically: true,
            encoding: .utf8,
        )

        let found = ComposerMentions.attachments(
            in: "diff @README.md against @gone.md",
            within: root.path,
        )

        #expect(found.map(\.name) == ["README.md"])
        #expect(found.first?.source == .file(root.appendingPathComponent("README.md")))
    }

    /// No Workspace, nothing named — the same degrade-down the menu makes on a rootless Session.
    @Test
    func `it names nothing without a Workspace`() {
        #expect(ComposerMentions.attachments(in: "read @README.md", within: nil).isEmpty)
    }

    /// The acceptance criterion itself: the file's CONTENT reaches the agent. It rides the same
    /// attachment path a drop does, so the Turn names the path and the agent's own `Read` pulls it
    /// in — which is also what makes it observable in the feed at the point it looked.
    @Test
    func `a mentioned file is named alongside what was dropped`() throws {
        let root = try workspace()
        let readme = root.appendingPathComponent("README.md")
        try "hello".write(to: readme, atomically: true, encoding: .utf8)
        let dropped = SessionAttachment.pastedImage(Data("png".utf8), fileExtension: "png")

        let going = ComposerMentions.attaching(
            [dropped],
            for: "compare @README.md with this",
            within: root.path,
        )

        #expect(going.map(\.name) == [SessionAttachment.pastedImageName, "README.md"])
    }

    /// A file both dropped and mentioned is one file. Named twice, the Turn would read as two.
    @Test
    func `a file both dropped and mentioned is named once`() throws {
        let root = try workspace()
        let readme = root.appendingPathComponent("README.md")
        try "hello".write(to: readme, atomically: true, encoding: .utf8)

        let going = ComposerMentions.attaching(
            [SessionAttachment.file(at: readme)],
            for: "look again at @README.md",
            within: root.path,
        )

        #expect(going.count == 1)
    }

    private func workspace() throws -> URL {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("argo-687-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root.standardizedFileURL
    }
}
