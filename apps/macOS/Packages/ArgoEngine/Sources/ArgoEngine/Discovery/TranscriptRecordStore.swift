import Foundation

/// A CLI's on-disk record: one directory per project, each holding that project's transcripts.
///
/// A port in the same sense as the readers around it — the CLI owns this directory, Argo only
/// observes it — which is why the root is a value the caller supplies rather than a constant
/// compiled in.
public struct TranscriptRecordStore: Sendable, Equatable {
    public let rootURL: URL

    public init(rootURL: URL) {
        self.rootURL = rootURL.standardizedFileURL
    }

    /// Where Claude Code writes.
    public static var claudeCode: TranscriptRecordStore {
        TranscriptRecordStore(
            rootURL: FileManager.default.homeDirectoryForCurrentUser
                .appending(path: ".claude/projects", directoryHint: .isDirectory),
        )
    }

    /// Every transcript exactly one level down, with its mtime.
    ///
    /// One level exactly: the directories below that (`subagents/`, `workflows/`) hold a Session's
    /// sidechains, which are read through the delegating tool call rather than tailed as Sessions
    /// of their own. A missing root — a machine that has never run the CLI — is an empty result and
    /// never a failure.
    func transcripts() -> [TranscriptFile] {
        contents(of: rootURL)
            .filter(isDirectory)
            .flatMap(transcripts(in:))
    }

    private func transcripts(in directoryURL: URL) -> [TranscriptFile] {
        contents(of: directoryURL)
            .filter { $0.pathExtension == "jsonl" }
            .compactMap(TranscriptFile.init(url:))
    }

    private func contents(of url: URL) -> [URL] {
        (try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.contentModificationDateKey, .isDirectoryKey],
            options: [.skipsHiddenFiles],
        )) ?? []
    }

    private func isDirectory(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
    }
}
