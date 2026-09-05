import ArgoEngine
import Foundation

/// The pictures a record NAMES rather than carries — the `![alt](source)` a tracker writes a
/// screenshot in (#1412).
///
/// Every other picture in the app is bytes Argo already holds (`MediaCache`). This one is an
/// address at somebody else's host, so it is fetched, and the fetch goes through the engine's own
/// `HTTPTransport`: a view that reached the network itself would be a second HTTP client, with a
/// second set of answers about what a refusal means.
///
/// What is held is the DECODE and not the bytes, in `MediaCache`'s own store under `MediaCache`'s
/// own ceiling — one ceiling and not two, so a body full of screenshots is charged against the
/// number ADR-0028 Rule 4 already bounds rather than against a second one beside it.
///
/// Every source reaching here is a web address, because that is what `MarkdownBlock.picture(_:)`
/// finds: a relative source has no base to resolve against and a `file:` one is somebody else's
/// disk, so neither is ever a picture block in the first place.
///
/// A fetch that fails is NOT written off. The surface that asked draws its alt text and asks again
/// the next time it appears, which is what makes a body opened while the machine was offline draw
/// its pictures when it is opened again.
@MainActor
final class MarkdownPictures {
    static let shared = MarkdownPictures()

    private let transport: HTTPTransport
    /// The fetches in flight, keyed by source, so two surfaces drawing one picture in the same
    /// frame share the one request.
    private var inFlight: [URL: Task<MediaBitmap?, Never>] = [:]

    init(transport: HTTPTransport = URLSessionTransport()) {
        self.transport = transport
    }

    /// Whatever is already decoded for `source`, fetching nothing. What a surface can draw the
    /// frame it appears in, so a picture drawn once is drawn again with no wait at all.
    func held(_ source: URL) -> MediaBitmap? {
        MediaCache.shared.held(key: source.absoluteString)
    }

    /// The picture at `source`, decoded for `box`. Held decodes answer at once; everything else is
    /// one request, shared by every caller that asks for it while it is in flight.
    func picture(at source: URL, in box: MediaBox) async -> MediaBitmap? {
        if let held = held(source), held.box.covers(box) {
            return held
        }
        if let running = inFlight[source] {
            return await running.value
        }
        let fetch = Task<MediaBitmap?, Never> { [transport] in
            await Self.fetched(source, in: box, over: transport)
        }
        inFlight[source] = fetch
        let bitmap = await fetch.value
        inFlight[source] = nil
        guard let bitmap, !Task.isCancelled else { return nil }
        MediaCache.shared.keep(bitmap, for: source.absoluteString)
        return bitmap
    }

    /// One fetch and one decode, off the main actor. `nonisolated` for the reason
    /// `MediaCache.decoded` states: a decode is about a frame of work, and it inherits the
    /// cancellation of whatever surface asked for it.
    nonisolated private static func fetched(
        _ source: URL,
        in box: MediaBox,
        over transport: HTTPTransport,
    )
        async -> MediaBitmap? {
        guard let data = try? await transport.send(HTTPRequest(url: source.absoluteString)),
              !Task.isCancelled
        else { return nil }
        return MediaDecode.bitmap(from: data, in: box, scale: MediaScale.display)
    }
}
