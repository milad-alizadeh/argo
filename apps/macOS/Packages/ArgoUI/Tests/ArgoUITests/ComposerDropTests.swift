import AppKit
import ArgoEngine
@testable import ArgoUI
import Testing
import UniformTypeIdentifiers

/// What a drag let go over the composer turns into (#732).
///
/// The case that made this a ticket is a screenshot dragged straight from the macOS preview: there
/// is no file yet, so the drag offers pixels and a promise of one. A target that read `URL` alone
/// matched neither and resolved the drop to an empty array — the drag animated, the wash appeared,
/// and nothing landed.
@Suite("Composer drop")
@MainActor
struct ComposerDropTests {
    /// Held as a whole item provider rather than as bytes handed to a helper: what broke was the
    /// TYPES the target registered, and only a provider offering one can show that it now matches.
    private static func provider(_ data: Data, as type: UTType) -> NSItemProvider {
        NSItemProvider(item: data as NSData, typeIdentifier: type.identifier)
    }

    /// The provider read the way a drop reads one. `loadTransferable` is the callback face of the
    /// same negotiation `dropDestination` runs, so this is the registered types under test rather
    /// than a helper called directly.
    private static func dropped(_ provider: NSItemProvider) async throws -> ComposerDrop {
        try await withCheckedThrowingContinuation { resumed in
            _ = provider.loadTransferable(type: ComposerDrop.self) { resumed.resume(with: $0) }
        }
    }

    @Test
    func `pixels dragged with no file behind them land as an attachment`() async throws {
        let drop = try await Self.dropped(Self.provider(Self.png(), as: .png))

        let attachment = drop.attachment
        #expect(attachment.isImage)
        #expect(attachment.name == SessionAttachment.droppedImageName)
        guard case let .bytes(data, fileExtension) = attachment.source else {
            Issue.record("dropped pixels should become bytes")
            return
        }
        #expect(fileExtension == "png")
        #expect(data == Self.png())
    }

    /// The extension the path ends in has to be the truth about the bytes behind it, so anything
    /// the drag offered in another encoding is re-encoded rather than mislabelled — the paste's own
    /// rule, and the same helper, so the two cannot drift.
    @Test
    func `pixels in another encoding are re-encoded rather than mislabelled`() async throws {
        let drop = try await Self.dropped(Self.provider(Self.tiff(), as: .tiff))

        guard case let .bytes(data, fileExtension) = drop.attachment.source else {
            Issue.record("dropped pixels should become bytes")
            return
        }
        #expect(fileExtension == "png")
        #expect(data.prefix(4) == Data([0x89, 0x50, 0x4E, 0x47]))
    }

    /// The other half of what the screenshot preview offers: a promise of a file that does not
    /// exist yet. The file it is fulfilled into is the system's own temporary one and is gone by
    /// the time a Turn could name it, so the bytes are read out of it rather than the path kept.
    @Test
    func `a promised file is fulfilled and held as bytes`() async throws {
        let promised = URL.temporaryDirectory.appending(path: "argo-\(UUID().uuidString).png")
        try Self.png().write(to: promised)
        defer { try? FileManager.default.removeItem(at: promised) }
        let provider = NSItemProvider()
        provider.registerFileRepresentation(
            forTypeIdentifier: UTType.png.identifier, fileOptions: [], visibility: .all,
        ) { hand in
            hand(promised, true, nil)
            return nil
        }

        let drop = try await Self.dropped(provider)

        #expect(drop.attachment.name == SessionAttachment.droppedImageName)
        guard case let .bytes(data, _) = drop.attachment.source else {
            Issue.record("a promised file should be read rather than pointed at")
            return
        }
        #expect(data.prefix(4) == Data([0x89, 0x50, 0x4E, 0x47]))
    }

    /// A file already on disk keeps its own path. Copying it would leave a second, staler version
    /// of a file the Session may be working in sitting beside the one it is working in.
    @Test
    func `a dragged file keeps its own path rather than becoming bytes`() async throws {
        let url = URL(filePath: "/argo/notes.md")
        let provider = NSItemProvider()
        provider.registerObject(url as NSURL, visibility: .all)

        let drop = try await Self.dropped(provider)

        #expect(drop.attachment.name == "notes.md")
        #expect(drop.attachment.source == .file(url))
    }

    /// A drag can offer a type it cannot actually produce. The refusal has to come back as a
    /// refusal rather than as an attachment of nothing.
    @Test
    func `pixels that will not decode are refused rather than attached`() async {
        let provider = Self.provider(Data("not an image".utf8), as: .jpeg)

        await #expect(throws: (any Error).self) {
            try await Self.dropped(provider)
        }
    }

    private static func tiff() -> Data {
        NSImage(size: NSSize(width: 2, height: 2), flipped: false) { rect in
            NSColor.black.setFill()
            rect.fill()
            return true
        }.tiffRepresentation ?? Data()
    }

    private static func png() -> Data {
        ComposerPasteboard.png(from: tiff()) ?? Data()
    }
}
