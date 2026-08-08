@testable import ArgoEngine
import Foundation

/// A client on the companion socket, speaking what the plugin's relay speaks: one JSON-RPC object
/// per line, over a Unix domain socket.
///
/// Blocking and synchronous on purpose. The server is on the main actor's run loop, so a test
/// drives it by writing and then letting that run loop turn — which is what `settle` is for.
struct CompanionClient {
    private let descriptor: Int32

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

    func close() {
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
