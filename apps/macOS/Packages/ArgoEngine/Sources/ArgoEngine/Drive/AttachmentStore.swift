import Foundation

/// Where a pasted attachment's bytes go, so that a Turn has a path to name.
///
/// **Argo's own per-machine data, not the Workspace.** #540 asked for the Workspace and the
/// Workspace is the wrong place: a screenshot written into the checkout appears in `git status` and
/// in Argo's own `Workspace.dirty` reading, so pasting a picture would report as the user having
/// changed something — and the fix for that would be Argo writing to the user's git config. The
/// handoff brief already establishes that an agent reads an absolute path outside its tree
/// (`Hub.handoffRoot`), which is the only thing the Workspace was buying.
///
/// A value over a folder, with no state of its own, so a suite can point one at a temporary
/// directory and assert on what lands there.
public struct AttachmentStore {
    private let root: URL

    public init(root: URL) {
        self.root = root
    }

    /// Give every attachment an address the agent can read, and answer them in the order they were
    /// given — which is the order the Turn names them in.
    ///
    /// A verb and not a noun: this WRITES. A file keeps its own path — there is nothing to write,
    /// and a copy would be the second version of it — so only bytes get an address made for them,
    /// and the folder is created only when there are some. A Session that has only ever had files
    /// dropped on it leaves nothing behind.
    ///
    /// Addressed by the attachment's own id, which is what makes a retry after a refused send
    /// rewrite the same file rather than leave a fresh copy beside the last one. Nothing reaps what
    /// lands here, and that is the choice rather than an oversight: the path is named in a
    /// transcript that outlives the Session, so bytes deleted later would leave a historical Turn
    /// pointing at nothing.
    @discardableResult
    public func address(_ attachments: [SessionAttachment], of sessionID: String) throws -> [URL] {
        let folder = root.appending(path: sessionID, directoryHint: .isDirectory)
        if attachments.contains(where: \.needsWriting) {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        }
        return try attachments.map { try path(for: $0, in: folder) }
    }

    private func path(for attachment: SessionAttachment, in folder: URL) throws -> URL {
        switch attachment.source {
        case let .file(url):
            return url
        case let .bytes(data, fileExtension):
            let url = folder.appending(path: "\(attachment.id.uuidString).\(fileExtension)")
            try data.write(to: url, options: .atomic)
            return url
        }
    }
}

private extension SessionAttachment {
    /// Whether this one has an address already, or has to be given one.
    var needsWriting: Bool {
        if case .bytes = source {
            return true
        }
        return false
    }
}
