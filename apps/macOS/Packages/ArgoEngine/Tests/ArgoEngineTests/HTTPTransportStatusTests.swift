@testable import ArgoEngine
import Foundation
import Testing

/// Which answers the real transport raises rather than hands on, and the one distinction only it
/// can make: GitHub throttles with the same 403 it refuses a token with, and nothing behind the
/// seam sees a header.
@Suite("HTTP transport status")
struct HTTPTransportStatusTests {
    private static func send(status: Int, headers: [String: String] = [:]) async -> Error? {
        let transport = URLSessionTransport(session: .stubbed)
        do {
            _ = try await transport.send(HTTPRequest(
                url: StubHTTPProtocol.url(status: status, headers: headers),
            ))
            return nil
        } catch {
            return error
        }
    }

    @Test
    func `a token the provider refused is unauthorized`() async {
        let refused = await Self.send(status: 403, headers: ["x-ratelimit-remaining": "4988"])

        #expect(refused as? HTTPTransportError == .unauthorized(code: 403, reason: nil))
    }

    @Test
    func `a spent primary rate limit is a limit and not a refusal`() async {
        // The whole reason this lives in the transport: read as `unauthorized` a throttle sends the
        // user through an OAuth round-trip that fixes nothing, and the remedy is waiting.
        let throttled = await Self.send(status: 403, headers: ["x-ratelimit-remaining": "0"])

        #expect(throttled as? HTTPTransportError == .rateLimited)
    }

    @Test
    func `a secondary rate limit is read off its retry-after`() async {
        let throttled = await Self.send(status: 403, headers: ["retry-after": "60"])

        #expect(throttled as? HTTPTransportError == .rateLimited)
    }

    @Test
    func `a 429 is a limit whatever it carries`() async {
        #expect(await Self.send(status: 429) as? HTTPTransportError == .rateLimited)
    }

    @Test
    func `an expired grant is unauthorized`() async {
        #expect(await Self.send(status: 401) as? HTTPTransportError == .unauthorized(
            code: 401,
            reason: nil,
        ))
    }

    @Test
    func `an outage has nothing in it to read`() async {
        #expect(await Self.send(status: 503) as? HTTPTransportError == .status(code: 503))
    }

    @Test
    func `every other 4xx is handed on as a body`() async {
        // The device flow's `authorization_pending` arrives as one and is not a failure at all.
        #expect(await Self.send(status: 422) == nil)
    }

    /// The validator a read is answered with, kept and sent back on the next ask — the half of a
    /// conditional request only the real transport can make (#1620).
    @Test
    func `the ETag a read answered with comes back as If-None-Match`() async throws {
        let transport = URLSessionTransport(session: .stubbed)
        let url = StubHTTPProtocol.url(status: 200, headers: ["ETag": #"W/"cafe""#])
        let asked = HTTPRequest(url: url).revalidated(true)

        _ = try await transport.fetch(asked)
        let second = try await transport.fetch(asked)

        #expect(Self.validator(in: second) == #"W/"cafe""#)
    }

    @Test
    func `a read that did not opt in carries no validator`() async throws {
        // Opt-in because a `304` only costs less than a body if the CALLER can still answer from
        // what it holds, and most of them hold nothing.
        let transport = URLSessionTransport(session: .stubbed)
        let url = StubHTTPProtocol.url(status: 200, headers: ["ETag": #"W/"cafe""#])

        _ = try await transport.fetch(HTTPRequest(url: url))
        let second = try await transport.fetch(HTTPRequest(url: url))

        #expect(Self.validator(in: second)?.isEmpty == true)
    }

    @Test
    func `a 304 is unchanged rather than an empty body`() async throws {
        let transport = URLSessionTransport(session: .stubbed)
        let url = Self.validated
        _ = try await transport.fetch(HTTPRequest(url: url).revalidated(true))

        let read = try await transport.fetch(HTTPRequest(url: url).revalidated(true))

        #expect(!read.isAnswered)
    }

    @Test
    func `a read through send is answered with a body whatever it asked for`() async throws {
        // A caller reading `Data` has no way to act on "unchanged", so it must never be offered
        // one: `send` strips the validator rather than trusting the request not to carry it.
        let transport = URLSessionTransport(session: .stubbed)
        let asked = HTTPRequest(url: Self.validated).revalidated(true)

        _ = try await transport.send(asked)
        let second = try await transport.send(asked)

        #expect(!second.isEmpty)
    }

    /// A URL whose endpoint offers to validate: it answers `304` to the ETag it last handed out,
    /// and a body to everything else.
    private static let validated = StubHTTPProtocol.url(
        status: 200, headers: ["ETag": #"W/"cafe""#, "validates": "1"],
    )

    /// What the stub echoed back, which is the `If-None-Match` the request went out with.
    private static func validator(in reply: HTTPReply) -> String? {
        struct Echo: Decodable { let ifNoneMatch: String }
        guard case let .answered(data) = reply else { return nil }
        return (try? JSONDecoder().decode(Echo.self, from: data))?.ifNoneMatch
    }
}

private extension HTTPReply {
    var isAnswered: Bool {
        if case .answered = self {
            return true
        }
        return false
    }
}
