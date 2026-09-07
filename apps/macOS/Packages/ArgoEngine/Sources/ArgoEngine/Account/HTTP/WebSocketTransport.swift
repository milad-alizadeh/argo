import Foundation

/// One socket, described rather than opened.
public struct WebSocketRequest: Sendable {
    public let url: String
    /// Sent verbatim on the handshake. GitHub's webhook forwarder takes the raw token in
    /// `Authorization` with no `Bearer` prefix, which is not what any of its HTTP endpoints take
    /// (`cli/gh-webhook`, `webhook/forward.go`).
    public let headers: [String: String]

    public init(url: String, headers: [String: String] = [:]) {
        self.url = url
        self.headers = headers
    }
}

/// One open socket: frames in, frames out, until the far end goes.
public protocol WebSocketChannel: Sendable {
    /// The next frame the far end sent. It throws once there is no far end, which is how a caller
    /// hears that the socket has ended — a close and a broken connection alike.
    func receive() async throws -> Data
    func send(_ frame: Data) async throws
    func close() async
}

/// The seam a live channel is opened through.
///
/// Behind it a test hands back scripted frames; in the app it is `URLSession`. No suite opens a
/// real connection.
public protocol WebSocketTransport: Sendable {
    func open(_ request: WebSocketRequest) async throws -> any WebSocketChannel
}

public enum WebSocketError: Error, Equatable {
    /// A frame in a form this build cannot read. `URLSessionWebSocketTask.Message` is a system enum
    /// and may gain a case, and a frame nobody can read is the end of the socket rather than a
    /// delivery to guess at.
    case unreadableFrame
    /// The handshake ran past its budget with no word from the delegate either way — the shape of
    /// the dial that shipped in #1579: a `resume()` nothing ever confirmed (#1643).
    case dialTimedOut
    /// The task completed before the handshake did, with no `Error` attached to say why.
    case dialFailed
}
