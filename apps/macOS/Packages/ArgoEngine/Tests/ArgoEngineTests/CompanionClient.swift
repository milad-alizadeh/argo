@testable import ArgoEngine
import Foundation

/// A client on the companion socket, speaking what the plugin's relay speaks: one JSON-RPC object
/// per line, over a Unix domain socket.
///
/// Blocking and synchronous on purpose. The server is on the main actor's run loop, so a test
/// drives it by writing and then letting that run loop turn — which is what `settle` is for.
///
/// A `final class` rather than a value, because the descriptor is a resource with a lifetime: as a
/// struct every COPY of it closed the same number, and the copies outlive each other (#936). The
/// lifetime is spelled out in full — `deinit` releases what no test closed by hand, and `close` is
/// idempotent — so neither end of it leaks and neither end of it closes twice.
@MainActor
final class CompanionClient {
    /// Why a dial that kept trying never landed: the errno of the last attempt and whether the
    /// socket file was even there. A bare `→ nil` named no cause, and three CI failures were spent
    /// guessing at one (#915).
    struct DialFailure: Error, CustomStringConvertible {
        let description: String
    }

    /// Readable so a test can name the number this client holds; `-1` once it has been released.
    private(set) var descriptor: Int32

    /// A dial that WAITS for the listener instead of assuming one attempt is enough (#915).
    ///
    /// Everything expecting a live socket comes through here. The one-shot `init?` below stays for
    /// the suites that are ABOUT a refusal: a withdrawn socket has to read gone at once rather than
    /// after a hang guard, and the backlog burst has to fill the queue without the main actor
    /// turning between dials.
    ///
    /// It SLEEPS between attempts for `settle`'s reason — the listener accepts on the main QUEUE,
    /// so a yield loop never leaves the actor that would open it.
    /// `within` is `settle`'s own hang guard everywhere but the one test ABOUT a dial that is never
    /// answered, which would otherwise spend the whole guard to prove it.
    static func dialled(
        _ socketPath: String,
        within bound: Duration = settleLimit,
    ) async throws
        -> CompanionClient {
        let deadline = ContinuousClock.now + bound
        while true {
            if let client = CompanionClient(socketPath: socketPath) {
                return client
            }
            let refusal = String(cString: strerror(errno))
            guard ContinuousClock.now < deadline else {
                throw DialFailure(description: """
                no listener on \(socketPath) (\(socketPath.utf8.count) bytes) within \
                \(bound): \(refusal), and the socket file is \
                \(FileManager.default.fileExists(atPath: socketPath) ? "there" : "not there")
                """)
            }
            try? await Task.sleep(for: .milliseconds(1))
        }
    }

    init?(socketPath: String) {
        // Bounded like the server's own copy: `sun_path` is 104 bytes, and a path longer than that
        // would overrun the struct rather than fail to connect.
        guard socketPath.utf8.count <= unixSocketPathLimit else { return nil }
        let descriptor = socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return nil }
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &address.sun_path) { field in
            for (offset, byte) in socketPath.utf8.enumerated() {
                field[offset] = byte
            }
        }
        let size = socklen_t(MemoryLayout<sockaddr_un>.size)
        let connected = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                connect(descriptor, $0, size)
            }
        }
        guard connected == 0 else {
            Darwin.close(descriptor)
            return nil
        }
        // Non-blocking, because the server is served BY the main actor: a blocking read here holds
        // the very run loop that would answer it, and the test would only ever pass on a timeout.
        _ = fcntl(descriptor, F_SETFL, O_NONBLOCK)
        self.descriptor = descriptor
    }

    func send(_ message: [String: Any]) {
        guard let line = CompanionResponse.line(message) else { return }
        sendLine(line)
    }

    /// One raw line, as the permission hook's relay would put it: whatever the text is, newline
    /// framed — which is what lets a test speak malformed lines too.
    func sendLine(_ line: String) {
        let bytes = Array((line + "\n").utf8)
        _ = bytes.withUnsafeBytes { write(descriptor, $0.baseAddress, bytes.count) }
    }

    /// One line back, or nothing yet. The caller polls this while yielding, so "nothing yet" and
    /// "never" are told apart by the caller's own bound rather than by a socket timeout.
    func receive() -> JSONValue? {
        var buffer = [UInt8](repeating: 0, count: 8192)
        let count = read(descriptor, &buffer, buffer.count)
        guard count > 0, let text = String(bytes: buffer[0 ..< count], encoding: .utf8) else {
            return nil
        }
        return text.split(whereSeparator: \.isNewline).first.flatMap {
            JSONValue.record(fromLine: String($0))
        }
    }

    /// Release the descriptor, once. Idempotent, because a second `close` of a number the kernel
    /// has already reissued lands on whatever now holds it — a listening socket in another suite,
    /// which is #936, or a subprocess pipe, which is #588.
    func close() {
        guard descriptor >= 0 else { return }
        Darwin.close(descriptor)
        descriptor = -1
    }

    /// The half of the lifetime no test spells: a client left to go out of scope releases its
    /// descriptor rather than holding the number for the life of the process. Safe unconditionally
    /// because `close` is idempotent, so a client that WAS closed by hand releases nothing here.
    deinit {
        guard descriptor >= 0 else { return }
        Darwin.close(descriptor)
    }

    /// A `tools/call` as the CLI would make it.
    static func toolCall(id: Int, name: String, arguments: [String: Any]) -> [String: Any] {
        [
            "jsonrpc": "2.0",
            "id": id,
            "method": "tools/call",
            "params": ["name": name, "arguments": arguments],
        ]
    }
}
