import Darwin
import Foundation

/// The loopback the browser is redirected back to, listened on for exactly one request.
///
/// `127.0.0.1` and never `0.0.0.0`: the authorization code arrives in a URL (ADR-0018).
///
/// **Claimed before the browser opens, never after** — a bind deferred to the wait would refuse
/// only once the user had already granted access.
protocol LinearRedirectListening: Sendable {
    /// Take the port. Raised before anything sends the user anywhere.
    func claim() throws(LinearAuthorizationError) -> LinearRedirectWait
}

/// A port already held, waiting for the one redirect it will answer.
protocol LinearRedirectWait: Sendable {
    func awaitRedirect() async throws(LinearAuthorizationError) -> [String: String]
}

/// The real socket. BSD sockets rather than `Network`, in the same idiom as `CompanionSocket`.
struct LinearRedirectCatcher: LinearRedirectListening {
    /// How long the browser has. Past this the wait is abandoned rather than left holding a port:
    /// a user who closed the tab is the common case, and nothing else says so.
    static let patience = Duration.seconds(300)

    func claim() throws(LinearAuthorizationError) -> LinearRedirectWait {
        try Held(descriptor: Self.listening())
    }

    /// The bound port, held across the browser round-trip and closed once it has answered.
    ///
    /// A `final class` rather than a value, because the descriptor is a resource with a lifetime:
    /// `deinit` is what closes it on the path where the wait is cancelled and nothing else runs.
    final class Held: LinearRedirectWait {
        private let descriptor: Int32

        init(descriptor: Int32) {
            self.descriptor = descriptor
        }

        deinit { Darwin.close(descriptor) }

        func awaitRedirect() async throws(LinearAuthorizationError) -> [String: String] {
            guard let line = await LinearRedirectCatcher.request(on: descriptor) else {
                throw LinearAuthorizationError.abandoned
            }
            return LinearRedirectCatcher.query(of: line)
        }
    }

    /// A bound, listening socket on the loopback, or the reason there is not one.
    private static func listening() throws(LinearAuthorizationError) -> Int32 {
        let descriptor = socket(AF_INET, SOCK_STREAM, 0)
        guard descriptor >= 0 else { throw LinearAuthorizationError.redirectUnavailable }
        var reuse: Int32 = 1
        setsockopt(
            descriptor, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size),
        )
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = LinearOAuthApp.redirectPort.bigEndian
        address.sin_addr.s_addr = INADDR_LOOPBACK.bigEndian
        let size = socklen_t(MemoryLayout<sockaddr_in>.size)
        let bound = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(descriptor, $0, size) }
        }
        guard bound == 0, listen(descriptor, 1) == 0 else {
            Darwin.close(descriptor)
            throw LinearAuthorizationError.redirectUnavailable
        }
        return descriptor
    }

    /// The request line of the one redirect, and `nil` where the patience ran out or the wait was
    /// cancelled. The accept runs off the main queue, so a browser that never comes back blocks a
    /// thread of the pool rather than the app.
    static func request(on listening: Int32) async -> String? {
        await withTaskGroup(of: String?.self) { group in
            group.addTask { await accept(on: listening) }
            group.addTask {
                try? await Task.sleep(for: patience)
                return nil
            }
            // The first of the two to finish decides: the redirect, or the patience running out.
            // Doubly optional — no task left, and a task that answered nothing — and both are the
            // same answer here.
            let first: String?? = await group.next()
            group.cancelAll()
            return first.flatMap(\.self)
        }
    }

    private static func accept(on listening: Int32) async -> String? {
        await withCheckedContinuation { continuation in
            DispatchQueue.global().async {
                let client = Darwin.accept(listening, nil, nil)
                guard client >= 0 else { return continuation.resume(returning: nil) }
                defer { Darwin.close(client) }
                let line = read(from: client)
                // Answered before the socket closes, so the user sees a page rather than a browser
                // error on the redirect Argo asked for.
                send(page, to: client)
                continuation.resume(returning: line)
            }
        }
    }

    /// The first line of the request, which is where a `GET` carries its query. The headers after
    /// it are not read: nothing here needs them, and reading to the end would wait on a browser
    /// that has already said everything.
    private static func read(from client: Int32) -> String? {
        var buffer = [UInt8](repeating: 0, count: 8192)
        let count = Darwin.read(client, &buffer, buffer.count)
        // A request line that is not UTF-8 is not a redirect Argo sent, so it reads as nothing
        // rather than as a line with replacement characters in the code.
        guard count > 0, let text = String(bytes: buffer[0 ..< count], encoding: .utf8) else {
            return nil
        }
        return text.split(separator: "\r\n", maxSplits: 1).first.map(String.init)
    }

    private static func send(_ body: String, to client: Int32) {
        let response = """
        HTTP/1.1 200 OK\r
        Content-Type: text/html; charset=utf-8\r
        Content-Length: \(body.utf8.count)\r
        Connection: close\r
        \r
        \(body)
        """
        _ = Array(response.utf8).withUnsafeBytes { Darwin.write(client, $0.baseAddress, $0.count) }
    }

    /// What the redirect renders. Deliberately plain and unbranded: it is a browser tab the user is
    /// about to close, not a surface.
    private static let page = """
    <!doctype html><meta charset="utf-8"><title>Argo</title>
    <body style="font: 15px -apple-system; padding: 3rem">
    Linear is connected. You can close this tab and go back to Argo.
    """

    /// The query of `GET /linear/callback?code=…&state=… HTTP/1.1`, percent-decoded.
    static func query(of requestLine: String) -> [String: String] {
        let target = requestLine.split(separator: " ").dropFirst().first ?? ""
        guard let query = target.split(separator: "?", maxSplits: 1).dropFirst().first else {
            return [:]
        }
        var read: [String: String] = [:]
        for pair in query.split(separator: "&") {
            let halves = pair.split(separator: "=", maxSplits: 1)
            guard let name = halves.first, let value = halves.dropFirst().first else { continue }
            read[String(name)] = String(value)
                .replacingOccurrences(of: "+", with: " ")
                .removingPercentEncoding
        }
        return read
    }
}
