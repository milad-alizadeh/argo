import Foundation

/// The longest path an `AF_UNIX` address can carry (`sun_path` is 104 bytes on Darwin, minus the
/// terminator). Checked rather than trusted: a home directory deep enough to overflow it would
/// otherwise bind to a silently truncated path.
///
/// At file scope because it is a fact about the address family, not about either end of it — both
/// the listener and anything that dials it are bound by the same 104 bytes.
let unixSocketPathLimit = 103

/// The companion channel's listening end: one Unix domain socket per claim.
///
/// A socket per claim rather than one server with a token, because the file IS the capability. It
/// lives in a directory that is the user's alone (0700) and is itself 0600, so the only process
/// that can reach a Session's channel is one this user started — and its path is handed to exactly
/// one spawn.
@MainActor
final class CompanionSocket {
    let path: String
    private let respond: (String) -> String?
    private var descriptor: Int32 = -1
    private var source: DispatchSourceRead?
    private var connections: [Int: CompanionConnection] = [:]
    private var accepted = 0

    init(path: String, respond: @escaping (String) -> String?) {
        self.path = path
        self.respond = respond
    }

    /// Bind and start accepting. Throws rather than degrading, because a spawn that went ahead
    /// without its channel would be a managed Session promising a CONVENTION tier it cannot serve.
    func open() throws {
        guard path.utf8.count <= unixSocketPathLimit else {
            throw AgentSpawnError.hostRefused(detail: "Companion socket path is too long")
        }
        unlink(path)
        let descriptor = socket(AF_UNIX, SOCK_STREAM, 0)
        guard descriptor >= 0 else {
            throw AgentSpawnError.hostRefused(detail: "Companion socket unavailable")
        }
        self.descriptor = descriptor
        try bindAndListen(descriptor)
        // 0600 before anything connects: the capability is the file, so its mode is the whole
        // access control story.
        chmod(path, 0o600)
        accept(on: descriptor)
    }

    func close() {
        // Cancelling is what closes the listening descriptor — see `accept(on:)`.
        source?.cancel()
        source = nil
        descriptor = -1
        let closing = connections.values
        connections = [:]
        for connection in closing {
            connection.close()
        }
        unlink(path)
    }

    private func bindAndListen(_ descriptor: Int32) throws {
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &address.sun_path) { field in
            for (offset, byte) in path.utf8.enumerated() {
                field[offset] = byte
            }
        }
        let size = socklen_t(MemoryLayout<sockaddr_un>.size)
        let didBind = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(descriptor, $0, size) }
        }
        guard didBind == 0, listen(descriptor, 4) == 0 else {
            Darwin.close(descriptor)
            self.descriptor = -1
            // A successful `bind` creates the file even when `listen` then fails, and a socket file
            // nothing is listening on is a channel a plugin would dial forever.
            unlink(path)
            throw AgentSpawnError.hostRefused(detail: "Companion socket could not be opened")
        }
    }

    private func accept(on descriptor: Int32) {
        _ = fcntl(descriptor, F_SETFL, O_NONBLOCK)
        let source = DispatchSource.makeReadSource(fileDescriptor: descriptor, queue: .main)
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated { self?.acceptOne(descriptor) }
        }
        // Closed by the cancel handler and nowhere else: `cancel` is asynchronous, so closing
        // alongside it frees a number GCD is still watching — which the next socket then gets.
        source.setCancelHandler { Darwin.close(descriptor) }
        source.resume()
        self.source = source
    }

    private func acceptOne(_ listening: Int32) {
        let client = Darwin.accept(listening, nil, nil)
        guard client >= 0 else { return }
        accepted += 1
        let key = accepted
        let connection = CompanionConnection(
            descriptor: client,
            respond: respond,
            onClose: { [weak self] in self?.drop(key) },
        )
        connections[key] = connection
        connection.open()
    }

    private func drop(_ key: Int) {
        connections.removeValue(forKey: key)?.close()
    }
}
