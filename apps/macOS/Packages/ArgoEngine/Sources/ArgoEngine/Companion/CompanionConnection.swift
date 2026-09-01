import Foundation

/// One client on the companion socket, speaking newline-delimited JSON-RPC — the framing MCP's
/// stdio transport uses, which is what lets the plugin reach this server through a plain relay.
///
/// Everything here runs on the main queue, affordable because it is a handful of small JSON lines
/// per Turn on a non-blocking descriptor. The PTY's bulk traffic goes nowhere near it.
@MainActor
final class CompanionConnection {
    /// A reply owed for one line — callable now for a request answered in place, or held and
    /// called later for one that waits on a decision.
    typealias Reply = @MainActor (String) -> Void

    /// `-1` once `close` has handed the number to the read source's cancel handler, so nothing
    /// here reads, writes or closes a number the kernel may already have reissued.
    private var descriptor: Int32
    private let respond: (String, @escaping Reply) -> Void
    private let onClose: () -> Void
    /// Whether the first reply ends the connection — the hook channel's one-exchange lifecycle,
    /// where closing is what releases the relay waiting on the far end.
    private let endsAfterReply: Bool
    private var closeWhenDrained = false
    private var source: DispatchSourceRead?
    private var writeSource: DispatchSourceWrite?
    private static let newline = UInt8(ascii: "\n")
    private var pending: [UInt8] = []
    private var outbox: [UInt8] = []

    init(
        descriptor: Int32,
        endsAfterReply: Bool = false,
        respond: @escaping (String, @escaping Reply) -> Void,
        onClose: @escaping () -> Void,
    ) {
        self.descriptor = descriptor
        self.endsAfterReply = endsAfterReply
        self.respond = respond
        self.onClose = onClose
    }

    func open() {
        _ = fcntl(descriptor, F_SETFL, O_NONBLOCK)
        let source = DispatchSource.makeReadSource(fileDescriptor: descriptor, queue: .main)
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated { self?.readAvailable() }
        }
        // Once a source holds the number it is closed HERE and nowhere else. `cancel` is
        // asynchronous, so closing beside it would free a number GCD is still watching — and the
        // next `accept` hands that same number to another claim's connection.
        let closing = descriptor
        source.setCancelHandler { Darwin.close(closing) }
        source.resume()
        self.source = source
    }

    func close() {
        writeSource?.cancel()
        writeSource = nil
        source?.cancel()
        source = nil
        descriptor = -1
    }

    /// The half of the lifetime no caller spells. A connection dropped without a `close` still owns
    /// its descriptor: an activated source is retained by GCD, so the cancel that releases the
    /// number has to be asked for here or it never comes.
    ///
    /// Nothing is closed by hand while a source holds the number — `open` arranged for exactly one
    /// closer, and a second one here would be the double close that arrangement exists to avoid.
    deinit {
        guard descriptor >= 0 else { return }
        guard let source else {
            Darwin.close(descriptor)
            return
        }
        writeSource?.cancel()
        source.cancel()
    }

    private func readAvailable() {
        var buffer = [UInt8](repeating: 0, count: 8192)
        let count = read(descriptor, &buffer, buffer.count)
        guard count > 0 else {
            // 0 is the peer gone. `EAGAIN` is a spurious wake-up and `EINTR` a signal landing
            // mid-call — neither says anything about the peer, and treating either as a hang-up
            // would drop a live channel on a passing interruption.
            if count == 0 || (errno != EAGAIN && errno != EINTR) {
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
            guard let line else { continue }
            respond(line) { [weak self] reply in self?.send(reply) }
        }
    }

    private func send(_ reply: String) {
        outbox += Array((reply + "\n").utf8)
        closeWhenDrained = endsAfterReply
        flush()
    }

    /// Write what the socket will take, and wait to be told when it will take more.
    ///
    /// Never spins. This runs on the main queue, so a client that connects and stops reading would
    /// otherwise freeze the whole window until it changed its mind — an agent's misbehaviour taking
    /// the cockpit down with it.
    private func flush() {
        while !outbox.isEmpty {
            let written = outbox.withUnsafeBytes { raw -> Int in
                guard let base = raw.baseAddress else { return -1 }
                return write(descriptor, base, outbox.count)
            }
            if written > 0 {
                outbox.removeFirst(written)
                continue
            }
            guard errno == EAGAIN || errno == EINTR else { return onClose() }
            armWriteSource()
            return
        }
        writeSource?.cancel()
        writeSource = nil
        // Only once everything owed is on the wire: a reply that closed beside its own send would
        // race the bytes it was closing after.
        if closeWhenDrained {
            onClose()
        }
    }

    /// Armed only while there is a backlog, and cancelled the moment there is not: a write source
    /// left running fires continuously for as long as the socket is writable.
    ///
    /// Its cancel handler does NOT close the descriptor — the read source above owns that, and two
    /// handlers closing one number is the double-close this whole arrangement exists to avoid.
    private func armWriteSource() {
        guard writeSource == nil else { return }
        let source = DispatchSource.makeWriteSource(fileDescriptor: descriptor, queue: .main)
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated { self?.flush() }
        }
        source.resume()
        writeSource = source
    }
}
