import Foundation

/// One Hub's own corner of the shared companion root: where that Hub's per-claim sockets and
/// plugin directories are written.
///
/// The CORNER is what makes those paths unique, never the claim id inside it (#987). Claim ids are
/// minted per `SessionOwnership` — one counter per Hub — so two Hubs over one root both mint
/// `claim-1`, and a socket named by the claim alone would be one file two channels bind in turn:
/// `CompanionSocket.open` unlinks before it binds, so the second Hub would take the first Hub's
/// live channel away, and `CompanionPlugin.remove` would delete the first Hub's hook.
///
/// Named by process and by order of construction, which is what makes it structural rather than
/// conventional: a pid is unique among live processes and the counter among the Hubs of one, so no
/// two live Hubs anywhere can name the same corner. Two Argo processes on the default root are the
/// case a per-process counter alone would still collide on.
struct CompanionScope {
    /// Where this Hub's own files go — the only directory any channel of it may write or remove.
    let root: URL

    private let parent: URL
    @MainActor private static var opened = 0

    @MainActor
    init(under parent: URL) {
        Self.opened += 1
        self.parent = parent
        self.root = parent.appending(
            path: "hub-\(getpid())-\(Self.opened)",
            directoryHint: .isDirectory,
        )
    }

    /// Both levels 0700, the shared parent included: the socket inside is the capability, and a
    /// directory another user could list would hand its name away.
    func createDirectory() throws {
        for directory in [parent, root] {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700],
            )
        }
    }
}
