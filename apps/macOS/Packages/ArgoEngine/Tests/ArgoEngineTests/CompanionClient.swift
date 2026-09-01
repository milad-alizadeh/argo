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
    /// Why a dial was refused, as facts rather than as a sentence: a caller that has to read the
    /// cause out of prose reds when the prose is reworded (#915).
    struct DialFailure: Error, CustomStringConvertible {
        let socketPath: String
        /// errno at the moment of the refusal, and `nil` where the path was rejected before any
        /// syscall ran — there is no errno to read then, and a stale one names the wrong cause.
        let refusal: Int32?
        let isSocketFilePresent: Bool

        var pathBytes: Int {
            socketPath.utf8.count
        }

        var description: String {
            let why = refusal.map { String(cString: strerror($0)) }
                ?? "over sun_path's \(unixSocketPathLimit) bytes"
            let file = isSocketFilePresent ? "there" : "not there"
            return "no listener on \(socketPath) (\(pathBytes) bytes): \(why), "
                + "and the socket file is \(file)"
        }
    }

    /// One attempt, carrying the errno taken AT the call that failed. `close` and `FileManager`
    /// both set errno, so a reading taken after the attempt returns names whichever ran last.
    private enum Attempt {
        case connected(Int32)
        case refused(errno: Int32)
        /// Refused before any syscall, so there is no errno to carry.
        case pathTooLong
    }

    /// Readable so a test can name the number this client holds; `-1` once it has been released.
    private(set) var descriptor: Int32

    /// A dial that waits for the listener rather than assuming one attempt is enough (#915).
    ///
    /// `within` is `settle`'s own hang guard everywhere but the test about a dial nothing answers.
    static func dialled(
        _ socketPath: String,
        within bound: Duration = settleLimit,
    ) async throws
        -> CompanionClient {
        let deadline = ContinuousClock.now + bound
        while true {
            switch attempt(on: socketPath) {
            case let .connected(descriptor):
                return CompanionClient(holding: descriptor)
            // Waiting cannot change the length, so this one never spends the guard.
            case .pathTooLong:
                throw failure(socketPath, refusal: nil)
            case let .refused(code):
                guard ContinuousClock.now < deadline else {
                    throw failure(socketPath, refusal: code)
                }
                // Sleeps rather than yields: the listener accepts on the main QUEUE, and a yield
                // loop re-enqueues on the actor without ever leaving it.
                try? await Task.sleep(for: .milliseconds(1))
            }
        }
    }

    /// One dial and one answer, never a wait — for the suites that are ABOUT a refusal: a withdrawn
    /// socket has to read gone at once rather than after the guard above, and the backlog burst has
    /// to fill the listen queue without the main actor turning between dials.
    ///
    /// The only way to a single attempt, because the initializer is private: a fixture expecting a
    /// LIVE socket can no longer reach one by writing the obvious constructor (#915).
    static func dialledOnce(_ socketPath: String) -> CompanionClient? {
        guard case let .connected(descriptor) = attempt(on: socketPath) else { return nil }
        return CompanionClient(holding: descriptor)
    }

    private init(holding descriptor: Int32) {
        self.descriptor = descriptor
    }

    private static func failure(_ socketPath: String, refusal: Int32?) -> DialFailure {
        DialFailure(
            socketPath: socketPath,
            refusal: refusal,
            isSocketFilePresent: FileManager.default.fileExists(atPath: socketPath),
        )
    }

    private static func attempt(on socketPath: String) -> Attempt {
        // `sun_path` is 104 bytes, and a longer path would overrun the struct rather than fail to
        // connect.
        guard socketPath.utf8.count <= unixSocketPathLimit else { return .pathTooLong }
        let descriptor = socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return .refused(errno: errno) }
        guard connect(descriptor, to: socketPath) else {
            let refusal = errno
            Darwin.close(descriptor)
            return .refused(errno: refusal)
        }
        // Non-blocking, because the server is served BY the main actor: a blocking read here holds
        // the very run loop that would answer it, and the test would only ever pass on a timeout.
        _ = fcntl(descriptor, F_SETFL, O_NONBLOCK)
        return .connected(descriptor)
    }

    private static func connect(_ descriptor: Int32, to socketPath: String) -> Bool {
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &address.sun_path) { field in
            for (offset, byte) in socketPath.utf8.enumerated() {
                field[offset] = byte
            }
        }
        let size = socklen_t(MemoryLayout<sockaddr_un>.size)
        return withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(descriptor, $0, size)
            }
        } == 0
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
