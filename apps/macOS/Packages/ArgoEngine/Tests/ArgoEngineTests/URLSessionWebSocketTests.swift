@testable import ArgoEngine
import Foundation
import Testing

/// `URLSessionWebSocket` against a real socket (#1643): the one seam every other suite about the
/// forwarder scripts away. `GitHubDeliveryWatchTests` proves the hook and the frame shapes;
/// `DeliverySocketTests` proves the reconnect loop; neither ever dials a live connection, so
/// neither
/// would have failed the day the dial itself stopped holding one (#1579 shipped exactly that).
///
/// A local server on the loopback stands in for the forwarder. If `URLSessionWebSocket` ever again
/// hands back a channel with no connection under it, this is what turns silent into failing.
@Suite("URLSession web socket", .timeLimit(.minutes(1)))
struct URLSessionWebSocketTests {
    @Test
    func `opening a request dials a real connection and carries its headers`() async throws {
        let server = try LocalWebSocketServer()
        let transport = URLSessionWebSocket()

        async let handshake = server.acceptHandshake()
        let channel = try await transport.open(
            WebSocketRequest(
                url: "ws://127.0.0.1:\(server.port)/forward",
                headers: ["Authorization": "raw-token-123"],
            ),
        )
        #expect(await handshake)
        // The header GitHub's forwarder is dialled with, read back off the socket that actually
        // reached the server — not off a request object nothing sent.
        #expect(await server.handshakeHeaders["authorization"] == "raw-token-123")

        await server.send(#"{"hello":"forwarder"}"#)
        let received = try await channel.receive()
        #expect(String(data: received, encoding: .utf8) == #"{"hello":"forwarder"}"#)

        try await channel.send(Data(#"{"Status":200}"#.utf8))
        let sent = await server.receiveText()
        #expect(sent == #"{"Status":200}"#)

        await channel.close()
        await server.close()
    }

    @Test
    func `a handshake nothing answers times the dial out rather than hanging it forever`(
    ) async throws {
        // #1579's actual shape: `resume()` returns, nothing confirms the upgrade, and the caller is
        // none the wiser. A server that is up but never accepts is what that looks like from the
        // dial's side — no TCP refusal, no HTTP response, just silence. This is the case a scripted
        // socket cannot express at all: it has no "never answered" to script.
        let server = try LocalWebSocketServer()
        let transport = URLSessionWebSocket(dialTimeout: .milliseconds(500))

        await #expect(throws: WebSocketError.dialTimedOut) {
            _ = try await transport.open(
                WebSocketRequest(url: "ws://127.0.0.1:\(server.port)/forward", headers: [:]),
            )
        }
    }
}
