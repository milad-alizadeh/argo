import AppKit
import ArgoEngine
@testable import ArgoUI
import Testing

/// What ⌘V over the composer turns into. Against a pasteboard of this suite's own rather than the
/// machine's, so the claims are about what was ON the board and not about what the developer last
/// copied.
@Suite("Composer pasteboard")
@MainActor
struct ComposerPasteboardTests {
    /// A screenshot: pixels with nowhere to be read from, so it becomes bytes and takes the name
    /// the chip shows rather than one it does not have.
    @Test
    func `an image on the board becomes one pasted attachment`() {
        let board = Self.board()
        board.setData(Self.png(), forType: .png)

        let attached = ComposerPasteboard.attachments(on: board)

        #expect(attached.count == 1)
        #expect(attached.first?.name == SessionAttachment.pastedImageName)
        #expect(attached.first?.isImage == true)
    }

    /// Copying a picture in the Finder puts the file's URL AND a preview of it on the board. The
    /// file is the better answer — it has a name, a size, and an address needing nothing written.
    @Test
    func `a file wins over the preview pixels beside it`() {
        let board = Self.board()
        board.writeObjects([URL(filePath: "/argo/notes.md") as NSURL])
        board.setData(Self.png(), forType: .png)

        let attached = ComposerPasteboard.attachments(on: board)

        #expect(attached.map(\.name) == ["notes.md"])
        if case .file = attached.first?.source {} else {
            Issue.record("a pasted file should keep its own path, not become bytes")
        }
    }

    /// A paste the FIELD should have taken must reach the field. `.text` is deliberately not one of
    /// the types the composer intercepts ⌘V for, or every quoted paragraph would become a chip.
    @Test
    func `text alone is not an attachment`() {
        let board = Self.board()
        board.setString("Fix the caption, not the sort.", forType: .string)

        #expect(ComposerPasteboard.attachments(on: board).isEmpty)
        #expect(!ComposerPasteboard.pastedTypes.contains(.plainText))
    }

    /// TIFF is what the board offers when nothing else is on it. The extension the path ends in has
    /// to be the truth about the bytes behind it, so it is re-encoded rather than mislabelled.
    @Test
    func `pixels offered only as TIFF are re-encoded rather than mislabelled`() throws {
        let board = Self.board()
        let tiff = try #require(NSImage(size: NSSize(width: 2, height: 2), flipped: false) { rect in
            NSColor.black.setFill()
            rect.fill()
            return true
        }.tiffRepresentation)
        board.setData(tiff, forType: .tiff)

        let attached = try #require(ComposerPasteboard.attachments(on: board).first)

        guard case let .bytes(data, fileExtension) = attached.source else {
            Issue.record("pasted pixels should become bytes")
            return
        }
        #expect(fileExtension == "png")
        // The PNG signature, so the claim is about the ENCODING and not about the name given it.
        #expect(data.prefix(4) == Data([0x89, 0x50, 0x4E, 0x47]))
    }

    private static func board() -> NSPasteboard {
        let board = NSPasteboard(name: NSPasteboard.Name("argo.test.\(UUID().uuidString)"))
        board.clearContents()
        return board
    }

    private static func png() -> Data {
        let image = NSImage(size: NSSize(width: 2, height: 2), flipped: false) { rect in
            NSColor.white.setFill()
            rect.fill()
            return true
        }
        guard let tiff = image.tiffRepresentation,
              let png = ComposerPasteboard.png(fromTIFF: tiff)
        else { return Data() }
        return png
    }
}
