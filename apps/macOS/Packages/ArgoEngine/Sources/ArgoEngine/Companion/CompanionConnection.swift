import Foundation

/// One client on the companion socket, speaking newline-delimited JSON-RPC — the framing MCP's
/// stdio transport uses, which is what lets the plugin reach this server through a plain relay.
///
/// Everything here runs on the main queue, which is affordable precisely because it is not a
/// terminal: a handful of small JSON lines per Turn, on a non-blocking descriptor. The PTY's
/// bulk traffic goes nowhere near it.
@MainActor
final class CompanionConnection {
    private let descriptor: Int32
    private let respond: (String) -> String?
    private let onClose: () -> Void
    private var source: DispatchSourceRead?
    private static let newline = UInt8(ascii: "\n")
    private var pending: [UInt8] = []

    init(descriptor: Int32, respond: @escaping (String) -> String?, onClose: @escaping () -> Void) {
        self.descriptor = descriptor
        self.respond = respond
        self.onClose = onClose
    }

    func open() {
        _ = fcntl(descriptor, F_SETFL, O_NONBLOCK)
        let source = DispatchSource.makeReadSource(fileDescriptor: descriptor, queue: .main)
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated { self?.readAvailable() }
        }
        source.resume()
        self.source = source
    }

    func close() {
        source?.cancel()
        source = nil
        Darwin.close(descriptor)
    }

    private func readAvailable() {
        var buffer = [UInt8](repeating: 0, count: 8192)
        let count = read(descriptor, &buffer, buffer.count)
        guard count > 0 else {
            // 0 is the peer gone; -1 with EAGAIN is a spurious wake-up and nothing to do.
            if count == 0 || errno != EAGAIN {
                onClose()
            }
            return
        }
        pending += buffer[0 ..< count]
        consumeLines()
    }

    /// Every complete line, leaving a partial one in the buffer: a request can arrive split across
    /// reads, and half a JSON object is not a malformed request — it is an unfinished one.
    ///
    /// Framed on the newline BYTE, before anything is decoded. A read boundary can land inside a
    /// UTF-8 sequence, so decoding the buffer first would corrupt the character it split — where a
    /// whole line either is valid UTF-8 or is input this server should refuse.
    private func consumeLines() {
        while let end = pending.firstIndex(of: Self.newline) {
            let line = String(bytes: pending[..<end], encoding: .utf8)
            pending = Array(pending[pending.index(after: end)...])
            guard let line, let reply = respond(line) else { continue }
            send(reply)
        }
    }

    private func send(_ reply: String) {
        var bytes = Array((reply + "\n").utf8)
        var offset = 0
        while offset < bytes.count {
            let written = bytes.withUnsafeBytes { raw -> Int in
                guard let base = raw.baseAddress else { return -1 }
                return write(descriptor, base + offset, bytes.count - offset)
            }
            guard written > 0 else {
                // EAGAIN on a socket whose buffer is momentarily full: the replies here are one
                // line each, so spinning until it drains is bounded and cannot deadlock.
                if errno == EAGAIN {
                    continue
                }
                onClose()
                return
            }
            offset += written
        }
    }
}
