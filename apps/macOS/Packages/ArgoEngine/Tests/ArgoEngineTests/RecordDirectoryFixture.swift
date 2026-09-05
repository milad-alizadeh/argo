@testable import ArgoEngine
import Foundation

/// One transcript to lay down in a fixture record directory.
struct FixtureTranscript {
    var directory = "project"
    var name = "session"
    var cwd: String?
    var modifiedAgo: TimeInterval = 0
    /// How many filler records to lay between the opening record and the closing one, each about a
    /// kilobyte. What makes a fixture longer than a bounded read's two ends
    /// (`TranscriptExcerpt.sideByteLimit`), so a whole reading of it and an excerpt are different
    /// values. Zero writes the one-line record every other suite here expects.
    var fillerRecords = 0
    /// A file whose records are not JSON at all — `cockpit-failure-states-spec.md` §8's case.
    /// There is a file, and nothing in it parses, so it reports no `cwd` however far it is read.
    var isUnparseable = false
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

    /// A path under the fixture root, for a Project or a working directory the test names. Named
    /// rather than created: most cases care only about the string a transcript carries.
    func path(_ name: String) -> String {
        rootURL.appending(path: name, directoryHint: .isDirectory).path
    }

    /// A folder that really exists, for a case whose subject is what the file system says about it.
    func directory(_ name: String) throws -> URL {
        let url = rootURL.appending(path: name, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// A folder reached through a symlink — a Project registered at a path that leads somewhere
    /// else, which is every case of #363.
    func symlink(_ name: String, to url: URL) throws -> URL {
        let link = rootURL.appending(path: name, directoryHint: .isDirectory)
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: url)
        return link
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

    /// Say one more thing at the end of a transcript already written — the append an agent makes,
    /// which also puts the file back inside the working set.
    func append(_ words: String, to url: URL) throws {
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: Data((Self.said(words) + "\n").utf8))
    }

    /// Move a transcript's mtime back, which is the only way a file leaves the working set.
    func age(_ url: URL, by interval: TimeInterval) throws {
        try FileManager.default.setAttributes(
            [.modificationDate: Date().addingTimeInterval(-interval)],
            ofItemAtPath: url.path,
        )
    }

    /// Give one transcript the mtime another has — the pair a relocation leaves, which is one
    /// file under two paths and so one moment of last activity under both.
    func matchModificationTime(of url: URL, to other: URL) throws {
        let held = try FileManager.default.attributesOfItem(atPath: other.path)
        guard let modified = held[.modificationDate] else { return }
        try FileManager.default.setAttributes(
            [.modificationDate: modified],
            ofItemAtPath: url.path,
        )
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    /// A user record is the smallest line that carries a `cwd`. One with none stands for a
    /// transcript whose opening records name no working directory.
    private static func record(for transcript: FixtureTranscript) -> String {
        guard !transcript.isUnparseable else { return "not a record at all\nnor is this\n" }
        guard let cwd = transcript.cwd else { return "{\"type\":\"user\"}\n" }
        let opening = "{\"type\":\"user\",\"cwd\":\"\(cwd)\"}"
        guard transcript.fillerRecords > 0 else { return opening + "\n" }
        let filler = (0 ..< transcript.fillerRecords)
            .map { said("\(fillerPrefix)\($0) " + padding) }
        return ([opening] + filler + [said(closingWords, stopping: true)]).joined(separator: "\n")
            + "\n"
    }

    /// One assistant record carrying a line of prose, and optionally the reason its Turn ended.
    private static func said(_ words: String, stopping: Bool = false) -> String {
        let stop = stopping ? ",\"stop_reason\":\"end_turn\"" : ""
        return "{\"type\":\"assistant\",\"message\":{\"role\":\"assistant\","
            + "\"content\":[{\"type\":\"text\",\"text\":\"\(words)\"}]\(stop)}}"
    }

    private static let padding = String(repeating: "x", count: 1024)
}

/// What a filler record says, so a test can ask whether the middle of a file was read.
let fillerPrefix = "filler "
/// What the LAST record of a filled fixture says — the one only a tail read reaches.
let closingWords = "The closing message"
