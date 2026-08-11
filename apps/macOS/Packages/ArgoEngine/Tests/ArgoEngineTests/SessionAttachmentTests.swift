@testable import ArgoEngine
import Foundation
import Testing

/// What an attachment becomes on the wire, and where its bytes end up (#540).
///
/// The Turn's text is asserted exactly because it IS the mechanism: Argo never reads the file, so
/// what reaches the agent is a path in a message, and whether the agent can act on it is entirely a
/// question of what those characters are.
@Suite("Session attachments")
struct SessionAttachmentTests {
    @Test
    func `a message with one attachment names its path under the words`() {
        let text = SessionTurn.text(
            "See the gap at the top.",
            attaching: [URL(filePath: "/argo/shot.png")],
        )

        #expect(text == "See the gap at the top.\n\n/argo/shot.png")
    }

    @Test
    func `several attachments are named in the order they were given`() {
        let text = SessionTurn.text("Both of these.", attaching: [
            URL(filePath: "/argo/one.png"),
            URL(filePath: "/argo/two.log"),
        ])

        #expect(text == "Both of these.\n\n/argo/one.png\n/argo/two.log")
    }

    /// Handing the agent a file is a complete thing to have said, so the paths stand alone rather
    /// than under a blank line with nothing above it.
    @Test
    func `an attachment with no words is the paths and nothing else`() {
        let text = SessionTurn.text("   ", attaching: [URL(filePath: "/argo/shot.png")])

        #expect(text == "/argo/shot.png")
    }

    /// A message with nothing attached must come through byte for byte — the composer's ordinary
    /// path runs through this same function.
    @Test
    func `a message with nothing attached is left exactly as it was typed`() {
        #expect(SessionTurn.text("first\n\nsecond ", attaching: []) == "first\n\nsecond ")
    }

    /// A file that is already on disk keeps its own path. Copying it would leave a second, staler
    /// version of a file the Session may be working in sitting beside the one it is working in.
    @Test
    func `a dropped file keeps its own path and writes nothing`() throws {
        let root = try TemporaryFolder()
        let store = AttachmentStore(root: root.url)
        let dropped = SessionAttachment.file(at: URL(filePath: "/argo/notes.md"))

        let paths = try store.address([dropped], of: "session-a")

        #expect(paths == [URL(filePath: "/argo/notes.md")])
        #expect(!FileManager.default.fileExists(atPath: root.url.appending(path: "session-a").path))
    }

    /// A paste has nowhere to be read from, so it gets an address — and the bytes at it are the
    /// bytes that were pasted, which is the whole of what makes the path worth naming.
    @Test
    func `a pasted image is written down and its path names the bytes`() throws {
        let root = try TemporaryFolder()
        let store = AttachmentStore(root: root.url)
        let bytes = Data([0x89, 0x50, 0x4E, 0x47])
        let pasted = SessionAttachment.pastedImage(bytes, fileExtension: "png")

        let paths = try store.address([pasted], of: "session-a")

        let written = try #require(paths.first)
        #expect(written.pathExtension == "png")
        #expect(try Data(contentsOf: written) == bytes)
    }

    /// Two pastes are two files. They are keyed by the attachment's own id rather than by a name
    /// they both lack, so the second cannot land on top of the first.
    @Test
    func `two pasted images do not land on each other`() throws {
        let root = try TemporaryFolder()
        let store = AttachmentStore(root: root.url)
        let first = SessionAttachment.pastedImage(Data([0x01]), fileExtension: "png")
        let second = SessionAttachment.pastedImage(Data([0x02]), fileExtension: "png")

        let paths = try store.address([first, second], of: "session-a")

        #expect(paths.count == 2)
        #expect(paths[0] != paths[1])
        #expect(try Data(contentsOf: paths[0]) == Data([0x01]))
        #expect(try Data(contentsOf: paths[1]) == Data([0x02]))
    }

    /// The bytes go to Argo's own data and never to the Project — a screenshot written into the
    /// checkout would report as the user having changed something.
    @Test
    func `pasted bytes land under the store's own root, keyed by Session`() throws {
        let root = try TemporaryFolder()
        let store = AttachmentStore(root: root.url)

        let paths = try store.address(
            [SessionAttachment.pastedImage(Data([0x01]), fileExtension: "png")],
            of: "session-b",
        )

        let written = try #require(paths.first)
        #expect(written.deletingLastPathComponent().lastPathComponent == "session-b")
        #expect(written.path.hasPrefix(root.url.path))
    }

    /// What makes a refused send survivable: the address is the attachment's own id, so pressing
    /// Retry rewrites the same file rather than leaving a fresh copy beside the last one.
    @Test
    func `addressing the same attachment twice writes the same file`() throws {
        let root = try TemporaryFolder()
        let store = AttachmentStore(root: root.url)
        let pasted = SessionAttachment.pastedImage(Data([0x01]), fileExtension: "png")

        let first = try store.address([pasted], of: "session-a")
        let again = try store.address([pasted], of: "session-a")

        #expect(first == again)
        let folder = root.url.appending(path: "session-a")
        let written = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        #expect(written.count == 1)
    }
}

/// A folder that goes when the test does.
private struct TemporaryFolder {
    let url: URL

    init() throws {
        self.url = URL(filePath: NSTemporaryDirectory())
            .appending(path: "argo-attachments-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    }
}
