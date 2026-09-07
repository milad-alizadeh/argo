import CryptoKit
import Darwin
import Foundation

/// A real WebSocket server on the loopback, for the one seam a scripted socket cannot stand in for:
/// whether `URLSessionWebSocket` actually dials, carries the handshake headers GitHub's forwarder
/// requires, and moves frames over a genuine connection (#1643).
///
/// BSD sockets rather than `Network`, in the same idiom as `LinearRedirectCatcher` — one raw
/// accept,
/// one hand-rolled RFC 6455 handshake, because nothing in this repo already speaks the server half
/// of
/// the upgrade. An actor because the descriptors it holds are read from a background thread the
/// blocking calls run on; every mutation of `client` and `handshakeHeaders` comes back through it.
/// The wire-level parsing (`WebSocketFrame`) is free of that isolation and lives in its own file.
actor LocalWebSocketServer {
    private let listening: Int32
    let port: UInt16
    private var client: Int32 = -1
    /// The handshake request's header lines, lower-cased by name — what a case reads to confirm the
    /// dial carried what the forwarder demands.
    private(set) var handshakeHeaders: [String: String] = [:]

    init() throws {
        let listening = socket(AF_INET, SOCK_STREAM, 0)
        guard listening >= 0 else { throw LocalWebSocketServerError.bindFailed }
        var reuse: Int32 = 1
        setsockopt(listening, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
        var address = sockaddr_in()
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = 0
        address.sin_addr.s_addr = INADDR_LOOPBACK.bigEndian
        let size = socklen_t(MemoryLayout<sockaddr_in>.size)
        let bound = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(listening, $0, size) }
        }
        guard bound == 0, listen(listening, 1) == 0 else {
            Darwin.close(listening)
            throw LocalWebSocketServerError.bindFailed
        }
        var boundAddress = sockaddr_in()
        var boundSize = size
        _ = withUnsafeMutablePointer(to: &boundAddress) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                getsockname(listening, $0, &boundSize)
            }
        }
        self.listening = listening
        self.port = UInt16(bigEndian: boundAddress.sin_port)
    }

    deinit {
        if client >= 0 {
            Darwin.close(client)
        }
        Darwin.close(listening)
    }

    /// Accept the one connection `URLSessionWebSocket` dials, and answer its upgrade — or `false`
    /// where nothing ever reached this port within `timeout`, which is the shape of #1643's actual
    /// defect: a dial that never happens leaves this waiting rather than answering.
    func acceptHandshake(timeout: Duration = .seconds(5)) async -> Bool {
        let listening = listening
        let accepted: Int32? = await withTaskGroup(of: Int32?.self) { group in
            group.addTask { await WebSocketFrame.accept(on: listening) }
            group.addTask {
                try? await Task.sleep(for: timeout)
                return nil
            }
            let first: Int32?? = await group.next()
            group.cancelAll()
            return first.flatMap(\.self)
        }
        guard let accepted,
              let request = WebSocketFrame.readRequest(from: accepted) else { return false }
        client = accepted
        handshakeHeaders = request.headers
        guard let key = request.headers["sec-websocket-key"] else { return false }
        WebSocketFrame.answer(accepted, key: key)
        return true
    }

    /// One text frame, unmasked as the server side of RFC 6455 requires.
    func send(_ text: String) {
        guard client >= 0 else { return }
        WebSocketFrame.write(text, to: client)
    }

    /// The next frame the client sent, unmasked — `nil` where the client closed or nothing arrived.
    func receiveText(timeout: Duration = .seconds(5)) async -> String? {
        guard client >= 0 else { return nil }
        let descriptor = client
        return await withTaskGroup(of: String?.self) { group in
            group.addTask { await WebSocketFrame.readClientFrame(from: descriptor) }
            group.addTask {
                try? await Task.sleep(for: timeout)
                return nil
            }
            let first: String?? = await group.next()
            group.cancelAll()
            return first.flatMap(\.self)
        }
    }

    func close() {
        if client >= 0 {
            Darwin.close(client)
            client = -1
        }
    }
}

enum LocalWebSocketServerError: Error {
    case bindFailed
}
