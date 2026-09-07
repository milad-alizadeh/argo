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

    /// Lay one transcript down, optionally with a Plan of `planSteps` written into it.
    ///
    /// The steps are laid in the shape #1594 measured on ten real Sessions: every one but the LAST
    /// is created halfway through the filler, where no end-window reaches it, and the last is
    /// created at the file's end where a bounded read does. So a fold of the two ends alone is a
    /// list of ONE — a real entry with a real status, and the wrong list.
    @discardableResult
    func write(_ transcript: FixtureTranscript, planSteps: Int = 0) throws -> URL {
        let directoryURL = rootURL.appending(
            path: transcript.directory,
            directoryHint: .isDirectory,
        )
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        let url = directoryURL.appending(path: "\(transcript.name).jsonl")
        try Data(Self.record(for: transcript, planSteps: planSteps).utf8).write(to: url)
        try age(url, by: transcript.modifiedAgo)
        return url
    }

    /// Say one more thing at the end of a transcript already written — the append an agent makes,
    /// which also puts the file back inside the working set.
    func append(_ words: String, to url: URL) throws {
        try append(record: Self.said(words), to: url)
    }

    /// One more step written down after the file has already been read — the live write a launch
    /// read has to fold ONTO the list it drew rather than under a list of its own.
    func append(created id: String, subject: String, to url: URL) throws {
        try append(
            record: Self.planCall(id, taskCreateTool, "\"subject\":\"\(subject)\""),
            to: url,
        )
    }

    private func append(record: String, to url: URL) throws {
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: Data((record + "\n").utf8))
    }

    /// Move a transcript's mtime back, which is the only way a file leaves the working set.
    func age(_ url: URL, by interval: TimeInterval) throws {
        try setModificationTime(of: url, to: Date().addingTimeInterval(-interval))
    }

    /// Give one transcript the mtime another has — the pair a relocation leaves, which is one
    /// file under two paths and so one moment of last activity under both.
    ///
    /// Throws where the file has no mtime to copy, rather than returning having done nothing: this
    /// is a test's PREMISE, and one that quietly did not hold is an assertion about something else.
    func matchModificationTime(of url: URL, to other: URL) throws {
        let held = try FileManager.default.attributesOfItem(atPath: other.path)
        guard let modified = held[.modificationDate] as? Date else {
            throw CocoaError(.fileReadUnknown)
        }
        try setModificationTime(of: url, to: modified)
    }

    /// The one write behind both of the above.
    private func setModificationTime(of url: URL, to date: Date) throws {
        try FileManager.default.setAttributes(
            [.modificationDate: date],
            ofItemAtPath: url.path,
        )
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    /// A user record is the smallest line that carries a `cwd`. One with none stands for a
    /// transcript whose opening records name no working directory.
    private static func record(for transcript: FixtureTranscript, planSteps steps: Int) -> String {
        guard !transcript.isUnparseable else { return "not a record at all\nnor is this\n" }
        guard let cwd = transcript.cwd else { return "{\"type\":\"user\"}\n" }
        let opening = "{\"type\":\"user\",\"cwd\":\"\(cwd)\"}"
        guard transcript.fillerRecords > 0 else { return opening + "\n" }
        let filler = (0 ..< transcript.fillerRecords)
            .map { said("\(fillerPrefix)\($0) " + padding) }
        let half = filler.count / 2
        let body = filler.prefix(half) + created(steps: 0 ..< max(steps - 1, 0))
            + filler.dropFirst(half) + created(steps: max(steps - 1, 0) ..< steps)
            + moved(steps: steps)
        return ([opening] + body + [said(closingWords, stopping: true)]).joined(separator: "\n")
            + "\n"
    }

    /// A `TaskCreate` per step, each followed by the result that names it — the only place the
    /// host's own task id is written, and so the only thing an update can be joined to.
    private static func created(steps: Range<Int>) -> [String] {
        steps.flatMap { step in
            [
                planCall(
                    "create-\(step)",
                    taskCreateTool,
                    "\"subject\":\"\(planStepPrefix)\(step)\"",
                ),
                planResult("create-\(step)", taskID: "\(step)"),
            ]
        }
    }

    /// A `TaskUpdate` per step: every one but the last completed, the last in progress. Written at
    /// the file's END, where a bounded read reaches them — and where, with the creates they address
    /// out of reach in the middle, they move nothing at all.
    private static func moved(steps: Int) -> [String] {
        (0 ..< steps).map { step in
            let status = step == steps - 1 ? "in_progress" : "completed"
            return planCall(
                "update-\(step)",
                taskUpdateTool,
                "\"taskId\":\"\(step)\",\"status\":\"\(status)\"",
            )
        }
    }

    /// One assistant record making one plan call.
    static func planCall(_ id: String, _ name: String, _ input: String) -> String {
        "{\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":"
            + "[{\"type\":\"tool_use\",\"id\":\"\(id)\",\"name\":\"\(name)\","
            + "\"input\":{\(input)}}]}}"
    }

    /// The result record a create comes back with.
    static func planResult(_ id: String, taskID: String) -> String {
        "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":"
            + "[{\"type\":\"tool_result\",\"tool_use_id\":\"\(id)\",\"content\":\"done\"}]},"
            + "\"toolUseResult\":{\"task\":{\"id\":\"\(taskID)\"}}}"
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
/// How a fixture's plan steps are named, so a test can say which of them a row drew.
let planStepPrefix = "Step "
