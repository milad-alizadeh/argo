import Foundation

@MainActor
public extension Hub {
    /// How this Hub's Sessions are driven.
    ///
    /// Built per read rather than stored: the adapter is a value over `ownership` and `terminals`,
    /// so there is nothing here to hold — and a stored driver would be a second reference to the
    /// two tables the spawn already keys everything by.
    ///
    /// One adapter, because `AgentCLI` has one case. When a second CLI can be spawned this becomes
    /// a choice made on the Session's own `cli`, and the wrong place to make it is the surface that
    /// raised the intent.
    var driver: some SessionDriver {
        ClaudeSessionDriver(
            ownership: ownership,
            terminals: terminals,
            permissions: permissions,
            attachments: AttachmentStore(root: Self.attachmentRoot),
        )
    }

    /// Where a pasted attachment's bytes land: Argo's own per-machine data, beside `handoffs/`.
    /// Never the Project — see `AttachmentStore` for why the Workspace was the wrong folder.
    static var attachmentRoot: URL {
        handoffRoot
            .deletingLastPathComponent()
            .appending(path: "attachments", directoryHint: .isDirectory)
    }
}
