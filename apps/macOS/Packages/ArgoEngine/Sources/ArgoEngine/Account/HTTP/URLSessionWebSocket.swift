import Foundation

/// The real socket transport: `URLSession`'s WebSocket task.
public struct URLSessionWebSocket: WebSocketTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func open(_ request: WebSocketRequest) async throws -> any WebSocketChannel {
        guard let url = URL(string: request.url) else {
            throw HTTPTransportError.malformedURL(request.url)
        }
        var urlRequest = URLRequest(url: url)
        for (name, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }
        return URLSessionWebSocketChannel(session: session, request: urlRequest)
    }
}

/// One `URLSessionWebSocketTask`, held by an actor.
///
/// An actor rather than a struct around the task because a `URLSessionTask` is not `Sendable`: made
/// here from the two values that are, it never crosses an isolation boundary at all.
actor URLSessionWebSocketChannel: WebSocketChannel {
    private let task: URLSessionWebSocketTask

    init(session: URLSession, request: URLRequest) {
        self.task = session.webSocketTask(with: request)
        task.resume()
    }

    /// The next frame, whichever form it arrived in. A binary frame is handed on as the bytes it
    /// is: what a frame MEANS is the adapter's to decide, and a transport that dropped one would
    /// hide a delivery rather than a detail.
    func receive() async throws -> Data {
        switch try await task.receive() {
        case let .data(data):
            return data
        case let .string(text):
            return Data(text.utf8)
        @unknown default:
            throw WebSocketError.unreadableFrame
        }
    }

    /// Sent as text, which is what the webhook forwarder answers a delivery on (#1579).
    func send(_ frame: Data) async throws {
        guard let text = String(bytes: frame, encoding: .utf8) else {
            throw WebSocketError.unreadableFrame
        }
        try await task.send(.string(text))
    }

    func close() {
        task.cancel(with: .goingAway, reason: nil)
    }
}
