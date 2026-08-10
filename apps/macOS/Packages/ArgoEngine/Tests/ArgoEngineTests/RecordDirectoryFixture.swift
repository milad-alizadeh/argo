@testable import ArgoEngine
import Foundation

/// One transcript to lay down in a fixture record directory.
struct FixtureTranscript {
    var directory = "project"
    var name = "session"
    var cwd: String?
    var modifiedAgo: TimeInterval = 0
}

/// A CLI record directory built on disk: a directory per project, holding transcripts whose `cwd`
/// and mtime the test chooses.
///
/// Built rather than checked in, because what the sweep reads is `stat` output — a committed
/// fixture's mtime would answer "outside the working set" forever, and the one filter that keeps a
/// cockpit off a thousand historical files would never be exercised.
struct RecordDirectoryFixture {
    let rootURL: URL

    init() throws {
        self.rootURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-record-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    var store: TranscriptRecordStore {
        TranscriptRecordStore(rootURL: rootURL, cli: .claude)
    }

    /// A path under the fixture root, for a Project or a working directory the test names.
    func path(_ name: String) -> String {
        rootURL.appending(path: name, directoryHint: .isDirectory).path
    }

    @discardableResult
    func write(_ transcript: FixtureTranscript) throws -> URL {
        let directoryURL = rootURL.appending(
            path: transcript.directory,
            directoryHint: .isDirectory,
        )
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let url = directoryURL.appending(path: "\(transcript.name).jsonl")
        try Data(Self.record(for: transcript).utf8).write(to: url)
        try age(url, by: transcript.modifiedAgo)
        return url
    }

    /// Move a transcript's mtime back, which is the only way a file leaves the working set.
    func age(_ url: URL, by interval: TimeInterval) throws {
        try FileManager.default.setAttributes(
            [.modificationDate: Date().addingTimeInterval(-interval)],
            ofItemAtPath: url.path,
        )
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    /// A user record is the smallest line that carries a `cwd`. One with none stands for a
    /// transcript whose opening records name no working directory.
    private static func record(for transcript: FixtureTranscript) -> String {
        guard let cwd = transcript.cwd else { return "{\"type\":\"user\"}\n" }
        return "{\"type\":\"user\",\"cwd\":\"\(cwd)\"}\n"
    }
}
