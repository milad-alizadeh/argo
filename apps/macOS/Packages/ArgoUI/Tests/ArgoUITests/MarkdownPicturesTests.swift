import AppKit
@testable import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Fetching the picture a record only NAMES (#1412).
///
/// The transport is the seam every provider adapter is tested through, so nothing here reaches the
/// network: what is asserted is which request went out, how many did, and what the answer settles
/// as.
///
/// A decode that lands is held in `MediaCache.shared`, which every case here shares, so each one
/// names a source of its OWN — a case reusing another's address would be answered out of the cache
/// and count no request at all.
@MainActor
@Suite("Markdown pictures")
struct MarkdownPicturesTests {
    private static let box = MediaBox.plate(ArgoFeedRow.picturePlate)

    /// One PNG, made rather than fixtured: what matters is that it decodes, not what is in it.
    private static func png() throws -> Data {
        let image = NSImage(size: CGSize(width: 8, height: 4))
        image.lockFocus()
        NSColor.systemTeal.setFill()
        NSRect(x: 0, y: 0, width: 8, height: 4).fill()
        image.unlockFocus()
        let tiff = try #require(image.tiffRepresentation)
        let bitmap = try #require(NSBitmapImageRep(data: tiff))
        return try #require(bitmap.representation(using: .png, properties: [:]))
    }

    private static func source(_ name: String) throws -> URL {
        try #require(URL(string: "https://example.com/\(name).png"))
    }

    @Test
    func `a picture is fetched from the address the record named`() async throws {
        let source = try Self.source("fetched")
        let transport = try RecordedPicture(answering: Self.png())
        let pictures = MarkdownPictures(transport: transport)

        let bitmap = await pictures.picture(at: source, in: Self.box)

        #expect(bitmap != nil)
        #expect(await transport.asked() == [source.absoluteString])
    }

    /// A refusal is nothing to draw. It is not an error the reader has to dismiss and it is not a
    /// wait that never ends — the surface asking settles it as its alt text.
    @Test
    func `an address that answers with nothing settles as no picture`() async throws {
        let pictures = MarkdownPictures(transport: RecordedPicture(answering: nil))

        #expect(try await pictures.picture(at: Self.source("refused"), in: Self.box) == nil)
    }

    /// Bytes that arrive and are not a picture are the same answer as no bytes. A signature nothing
    /// can decode must not read as a picture Argo is still decoding.
    @Test
    func `bytes that are no picture settle as no picture`() async throws {
        let transport = RecordedPicture(answering: Data("not a picture".utf8))
        let pictures = MarkdownPictures(transport: transport)

        #expect(try await pictures.picture(at: Self.source("garbage"), in: Self.box) == nil)
    }

    /// A body draws one source in more than one place, and every visible surface asks in the same
    /// frame. One request, or a page of screenshots is a page of duplicate fetches.
    @Test
    func `two surfaces asking at once share the one request`() async throws {
        let source = try Self.source("shared")
        let transport = try RecordedPicture(answering: Self.png())
        let pictures = MarkdownPictures(transport: transport)

        async let first = pictures.picture(at: source, in: Self.box)
        async let second = pictures.picture(at: source, in: Self.box)
        _ = await (first, second)

        #expect(await transport.asked().count == 1)
    }

    /// A failure is not remembered. A body opened while the machine was offline draws its pictures
    /// when it is opened again, rather than standing at alt text for the life of the process.
    @Test
    func `a source that failed is asked for again`() async throws {
        let source = try Self.source("retried")
        let transport = RecordedPicture(answering: nil)
        let pictures = MarkdownPictures(transport: transport)

        _ = await pictures.picture(at: source, in: Self.box)
        _ = await pictures.picture(at: source, in: Self.box)

        #expect(await transport.asked().count == 2)
    }
}

/// A transport that answers with one run of bytes and remembers what it was asked for. `nil` is
/// the refusal every failure reaches this code as — a 404, a throttle, or no network at all.
private actor RecordedPicture: HTTPTransport {
    private let answer: Data?
    private var sent: [String] = []

    init(answering answer: Data?) {
        self.answer = answer
    }

    func send(_ request: HTTPRequest) throws -> Data {
        sent.append(request.url)
        guard let answer else { throw HTTPTransportError.status(code: 404) }
        return answer
    }

    /// Every address that went out, in order — what a test asserting on requests NOT made reads.
    func asked() -> [String] {
        sent
    }
}
