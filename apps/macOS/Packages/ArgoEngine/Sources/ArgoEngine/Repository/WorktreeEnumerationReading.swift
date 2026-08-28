import Foundation

/// Reading which working trees a repository holds. A port, so this is falsifiable without a
/// repository on disk.
public typealias WorktreeEnumerationRead = @Sendable (URL) async -> [WorktreeEntry]

/// The app's adapter: git, through a subprocess. One reader for the process, so the blocking calls
/// queue behind one another rather than running a subprocess per poll.
public let gitWorktreeEnumerationRead: WorktreeEnumerationRead = { url in
    await gitWorktreeEnumerationReader.list(in: url)
}

private let gitWorktreeEnumerationReader = WorktreeEnumerationReader()
