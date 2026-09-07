import Foundation

/// The real socket transport: `URLSession`'s WebSocket task.
///
/// Dials on a session of its own, built with a delegate, rather than `.shared`: only the
/// delegate's `didOpenWithProtocol` is proof the upgrade actually completed, and only
/// `didCompleteWithError` is proof it failed. Without either, `resume()` returning tells a caller
/// nothing — a task that never gets past the handshake looks identical, from the constructor's
/// return value alone, to one that is about to carry frames for hours (#1643).
public struct URLSessionWebSocket: WebSocketTransport {
    /// How long the handshake gets before this counts as a dial that never happened. Short next to
    /// the reconnect backoff it feeds: a hung upgrade should read as one failed attempt, the same
    /// as a refused one, not as a watch that quietly stopped retrying.
    public static let dialTimeout = Duration.seconds(15)

    private let dialTimeout: Duration

    public init(dialTimeout: Duration = Self.dialTimeout) {
        self.dialTimeout = dialTimeout
    }

    public func open(_ request: WebSocketRequest) async throws -> any WebSocketChannel {
        guard let url = URL(string: request.url) else {
            throw HTTPTransportError.malformedURL(request.url)
        }
        var urlRequest = URLRequest(url: url)
        for (name, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }
        return try await URLSessionWebSocketChannel.dialled(urlRequest, timeout: dialTimeout)
    }
}

/// One `URLSessionWebSocketTask`, held by an actor.
///
/// An actor rather than a struct around the task because a `URLSessionTask` is not `Sendable`: made
/// here from the two values that are, it never crosses an isolation boundary at all.
actor URLSessionWebSocketChannel: WebSocketChannel {
    private let session: URLSession
    private let task: URLSessionWebSocketTask

    private init(session: URLSession, task: URLSessionWebSocketTask) {
        self.session = session
        self.task = task
    }

    /// Resumes the task and waits on the delegate's own word that the upgrade completed — a socket
    /// fd, not merely a `resume()` call nothing confirmed. Throws on a rejected handshake, a
    /// network failure, or `timeout` running out on a task that never heard back either way.
    static func dialled(
        _ request: URLRequest, timeout: Duration,
    ) async throws
        -> URLSessionWebSocketChannel {
        let delegate = DialDelegate()
        let session = URLSession(configuration: .ephemeral, delegate: delegate, delegateQueue: nil)
        let task = session.webSocketTask(with: request)
        task.resume()
        do {
            try await withThrowingTaskGroup(of: Void.self) { group in
                group.addTask { try await delegate.signal.wait() }
                group.addTask {
                    try await Task.sleep(for: timeout)
                    throw WebSocketError.dialTimedOut
                }
                try await group.next()
                group.cancelAll()
            }
        } catch {
            task.cancel()
            session.invalidateAndCancel()
            throw error
        }
        return URLSessionWebSocketChannel(session: session, task: task)
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
        session.invalidateAndCancel()
    }
}

/// The one signal `dialled(_:timeout:)` waits on: the delegate's own word, fired at most once,
/// racing whichever of open, fail or wait-with-a-continuation-already-late arrives first.
///
/// An actor rather than a lock: `URLSessionDelegate` callbacks land on the session's own delegate
/// queue, off any Swift actor, and `DialDelegate` hops onto this one with a fire-and-forget `Task`
/// rather than promising the concurrency checker a thread-safety no lock here can prove to it.
private actor DialSignal {
    private enum Outcome {
        case opened
        case failed(Error)
    }

    private var outcome: Outcome?
    private var continuation: CheckedContinuation<Void, Error>?

    func opened() {
        resolve(.opened)
    }

    func failed(_ error: Error) {
        resolve(.failed(error))
    }

    private func resolve(_ outcome: Outcome) {
        guard self.outcome == nil else { return }
        self.outcome = outcome
        guard let waiting = continuation else { return }
        continuation = nil
        Self.settle(waiting, with: outcome)
    }

    private static func settle(
        _ continuation: CheckedContinuation<Void, Error>,
        with outcome: Outcome,
    ) {
        switch outcome {
        case .opened: continuation.resume()
        case let .failed(error): continuation.resume(throwing: error)
        }
    }

    /// Cancellation-aware, because `group.cancelAll()` racing this against the timeout only works
    /// if losing the race actually resumes this continuation — a plain one left waiting is a task
    /// the enclosing `TaskGroup` will not let its scope exit until, which turns a bounded timeout
    /// back into the unbounded hang it exists to rule out.
    func wait() async throws {
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                if let outcome {
                    return Self.settle(continuation, with: outcome)
                }
                self.continuation = continuation
            }
        } onCancel: {
            Task { await self.failed(CancellationError()) }
        }
    }
}

/// Held by `dialled(_:timeout:)` only long enough to learn whether the handshake completed. Its
/// `URLSession` outlives it (the channel keeps that), but the delegate itself is never asked
/// anything again once `signal` has fired.
///
/// Checked `Sendable`, not `@unchecked`: its one stored property is a `let` of an actor, which the
/// concurrency checker can verify itself rather than take on faith.
private final class DialDelegate: NSObject, URLSessionWebSocketDelegate, Sendable {
    let signal = DialSignal()

    func urlSession(
        _: URLSession, webSocketTask _: URLSessionWebSocketTask, didOpenWithProtocol _: String?,
    ) {
        Task { await signal.opened() }
    }

    func urlSession(
        _: URLSession,
        task _: URLSessionTask,
        didCompleteWithError error: (any Error)?,
    ) {
        Task { await signal.failed(error ?? WebSocketError.dialFailed) }
    }
}
