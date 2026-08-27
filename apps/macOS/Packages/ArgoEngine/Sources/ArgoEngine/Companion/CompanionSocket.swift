import Foundation

/// The longest path an `AF_UNIX` address can carry (`sun_path` is 104 bytes on Darwin, minus the
/// terminator). Checked rather than trusted: a home directory deep enough to overflow it would
/// otherwise bind to a silently truncated path.
let unixSocketPathLimit = 103

/// How many dials may wait to be accepted. An `AF_UNIX` connection has no handshake to retry, so
/// the kernel REFUSES the dial past this rather than making the peer wait (#785) — and a refused
/// hook denies the call it was asking about. One agent Turn can raise a tool call per hook all at
/// once, so the depth has to cover a burst, not a caller.
private let listenBacklog = Int32(SOMAXCONN)

/// The companion channel's listening end: one Unix domain socket per claim.
///
/// The file IS the capability. It lives in a directory that is the user's alone (0700) and is
/// itself 0600, so the only process that can reach a Session's channel is one this user started —
/// and its path is handed to exactly one spawn.
@MainActor
final class CompanionSocket {
    let path: String
    private let respond: (String, Int, @escaping CompanionConnection.Reply) -> Void
    private let endsAfterReply: Bool
    private let onPeerClosed: (Int) -> Void
    private var descriptor: Int32 = -1
    private var source: DispatchSourceRead?
    private var connections: [Int: CompanionConnection] = [:]
    private var accepted = 0

    /// The full shape: each line arrives with the peer it came down and a reply that can be held
    /// open across a decision; `endsAfterReply` makes the first reply also the last, and
    /// `onPeerClosed` says when a peer went — answered or not, which is the caller's to tell.
    init(
        path: String,
        endsAfterReply: Bool = false,
        onPeerClosed: @escaping (Int) -> Void = { _ in },
        respond: @escaping (String, Int, @escaping CompanionConnection.Reply) -> Void,
    ) {
        self.path = path
        self.endsAfterReply = endsAfterReply
        self.onPeerClosed = onPeerClosed
        self.respond = respond
    }

    /// The companion channel's own shape: one line in, at most one answer out, decided in place.
    convenience init(path: String, respond: @escaping (String) -> String?) {
        self.init(path: path) { line, _, reply in
            guard let answer = respond(line) else { return }
            reply(answer)
        }
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
        guard didBind == 0, listen(descriptor, listenBacklog) == 0 else {
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
            MainActor.assumeIsolated { self?.acceptWaiting(descriptor) }
        }
        // Closed by the cancel handler and nowhere else: `cancel` is asynchronous, so closing
        // alongside it frees a number GCD is still watching — which the next socket then gets.
        source.setCancelHandler { Darwin.close(descriptor) }
        source.resume()
        self.source = source
    }

    /// EVERY dial waiting, not one per turn. The descriptor is non-blocking, so the drain ends on
    /// the first `accept` that finds nothing left.
    ///
    /// The backlog above is what makes a burst safe; this is why a burst costs ONE main-queue turn
    /// rather than one per dial, which is the resource the gate was starved of when #785 fired. No
    /// test proves this half — the read source re-fires, so one-per-turn drains eventually.
    private func acceptWaiting(_ listening: Int32) {
        while true {
            let client = Darwin.accept(listening, nil, nil)
            guard client >= 0 else { return }
            accept(client)
        }
    }

    private func accept(_ client: Int32) {
        accepted += 1
        let key = accepted
        let connection = CompanionConnection(
            descriptor: client,
            endsAfterReply: endsAfterReply,
            respond: { [weak self] line, reply in self?.respond(line, key, reply) },
            onClose: { [weak self] in self?.drop(key) },
        )
        connections[key] = connection
        connection.open()
    }

    private func drop(_ key: Int) {
        guard let connection = connections.removeValue(forKey: key) else { return }
        connection.close()
        onPeerClosed(key)
    }
}
