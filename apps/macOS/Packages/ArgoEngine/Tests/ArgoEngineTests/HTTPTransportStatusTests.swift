@testable import ArgoEngine
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
}
